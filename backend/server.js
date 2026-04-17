// ============================================================================
// backend/server.js
// Complete Express.js server with all routes
// ============================================================================

const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const AWS = require('aws-sdk');
const { Pool } = require('pg');
const winston = require('winston');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const googleDrive = require('./google-drive-manager');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================================
// Database Global State
// ============================================================================
let pool;
let isLocalDb = false; 
const localDbManager = require('./local-db-manager');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Trust the first proxy (Nginx reverse proxy on AWS) so express-rate-limit
// can read the real client IP from the X-Forwarded-For header.
app.set('trust proxy', 1);

// Helmet for security (configured to allow Google OAuth redirects/popups)
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5001'],
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500 // 50 concurrent users (~10 requests each per 15-min window)
});
app.use(limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================================
// LOGGING
// ============================================================================

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// ============================================================================
// DATABASE
// ============================================================================

// Try to connect to postgres, otherwise fallback to local DB
try {
  const { Pool } = require('pg');
  // AWS Free Tier (t2.micro): keep pool small to save RAM
  // 5 connections handles 50 concurrent users easily since queries are fast
  const poolSize = parseInt(process.env.DB_POOL_SIZE) || 5;
  pool = new Pool(
    process.env.DATABASE_URL
      ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: poolSize,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
      }
      : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'data_collection',
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
        max: poolSize,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
  );

  pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', err);
    if (err.message.includes('terminated unexpectedly') || err.message.includes('SSL')) {
      logger.warn('Idle DB connection was terminated. Marking as needing local fallback if persistent.');
    }
  });

  // ==========================================================================
  // INSTANCE-LEVEL MONKEY PATCH (Most Reliable)
  // ==========================================================================
  const originalQuery = pool.query.bind(pool);
  pool.query = async (...args) => {
    console.log(`[DB TRACE] pool.query called with: ${args[0]}`);
    if (isLocalDb) {
       console.log(`[DB TRACE] Routing to LocalDb`);
       return localDbManager.query(...args);
    }
    try {
      console.log(`[DB TRACE] Executing originalQuery`);
      const res = await originalQuery(...args);
      console.log(`[DB TRACE] Execution successful`);
      return res;
    } catch (err) {
      console.log(`[DB TRACE] Request failed: ${err.message}. Switching to Local DB.`);
      isLocalDb = true;
      return localDbManager.query(...args);
    }
  };

} catch (err) {
  logger.warn('PostgreSQL driver not found or failed, using local DB');
}

// ============================================================================
// AWS S3 — Primary storage for all collected data
// ============================================================================

const s3Config = {};
// If running on EC2 with IAM Role, credentials are auto-detected.
// If explicit keys are set, use them (local dev or non-IAM setups).
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  s3Config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
}
s3Config.region = process.env.AWS_REGION || 'ap-south-1';

const s3 = new AWS.S3(s3Config);
const s3BucketName = process.env.S3_BUCKET_NAME || 'data-collection-uploads';

// ── S3 helper — upload with up to 3 retries ─────────────────────────────────
const uploadToS3 = async (params, label = 'file') => {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await s3.upload(params).promise();
      logger.info(`[S3] ${label} uploaded successfully on attempt ${attempt}: ${params.Key}`);
      return true;
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      logger.error(`[S3] Upload attempt ${attempt}/${MAX_RETRIES} failed for ${label}: ${err.message} (code=${err.code})`);
      if (isLast) return false;
      await new Promise(r => setTimeout(r, attempt * 1500)); // 1.5 s, 3 s back-off
    }
  }
  return false;
};

// ============================================================================
// FILE UPLOAD
// ============================================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    const dir = '/tmp/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB — covers 2hr session at 200kbps (~180MB)
  fileFilter: (req, file, cb) => {
    // Accept both mp4 and webm — frontend records webm (vp8) and labels it correctly now
    const allowedMimes = ['video/mp4', 'video/webm', 'video/webm;codecs=vp8', 'application/json', 'text/csv'];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      logger.warn(`[upload] Rejected file with mimetype: ${file.mimetype}`);
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'jwt-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

const initializeDatabase = async () => {
  try {
    // Attempt basic query to check connection
    await pool.query('SELECT NOW()');

    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        age INTEGER,
        gender VARCHAR(50),
        institution VARCHAR(255),
        socioeconomic_status VARCHAR(50),
        academic_discipline VARCHAR(100),
        consent_given BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS survey_responses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        assessment_type VARCHAR(50),
        demographics JSONB,
        social_media_usage JSONB,
        attention_focus JSONB,
        working_memory JSONB,
        problem_solving JSONB,
        academic_performance JSONB,
        digital_wellness JSONB,
        sleep_wellbeing JSONB,
        completion_time_minutes FLOAT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        device_info JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_survey_user ON survey_responses(user_id);
      CREATE INDEX IF NOT EXISTS idx_survey_timestamp ON survey_responses(timestamp);

      CREATE TABLE IF NOT EXISTS cognitive_test_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        test_type VARCHAR(50),
        raw_score FLOAT,
        standardized_score FLOAT,
        percentile FLOAT,
        performance_data JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        examiner_id VARCHAR(100),
        location VARCHAR(255)
      );

      CREATE INDEX IF NOT EXISTS idx_cognitive_user ON cognitive_test_results(user_id);

      CREATE TABLE IF NOT EXISTS video_metadata (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        video_type VARCHAR(50),
        s3_bucket VARCHAR(255),
        s3_key VARCHAR(255),
        s3_url VARCHAR(500),
        file_size_mb FLOAT,
        duration_seconds FLOAT,
        frame_rate FLOAT,
        resolution VARCHAR(50),
        codec VARCHAR(50),
        upload_status VARCHAR(20),
        analysis_status VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_at TIMESTAMP,
        analyzed_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_video_user ON video_metadata(user_id);

      CREATE TABLE IF NOT EXISTS facial_analysis_results (
        id SERIAL PRIMARY KEY,
        video_id INTEGER NOT NULL REFERENCES video_metadata(id),
        dominant_emotion VARCHAR(50),
        emotion_probabilities JSONB,
        stress_level FLOAT,
        anxiety_probability FLOAT,
        action_units JSONB,
        gaze_direction JSONB,
        blink_rate FLOAT,
        eye_closure_frequency FLOAT,
        head_pitch FLOAT,
        head_yaw FLOAT,
        head_roll FLOAT,
        frame_count INTEGER,
        processing_time_seconds FLOAT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_facial_video ON facial_analysis_results(video_id);
    `;

    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }

    logger.info('Database initialized successfully');
  } catch (error) {
    if (!isLocalDb) { // Don't log error if we already switched to local DB
      logger.error('Database initialization error:', error);
    } else {
      logger.info('Using Local Simulated Database');
    }
  }
};

// ============================================================================
// ROUTES - AUTHENTICATION
// ============================================================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, age, gender, institution, socioeconomic_status, academic_discipline } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, age, gender, institution, socioeconomic_status, academic_discipline)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, age, gender, institution, created_at`,
      [email, hashedPassword, age, gender, institution, socioeconomic_status, academic_discipline]
    );

    const user = result.rows[0];
    logger.info(`New user registered: ${user.id}`);

    res.status(201).json({
      message: 'Registration successful',
      user: user
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, age, gender, institution FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'jwt-secret-key',
      { expiresIn: '24h' }
    );

    logger.info(`User logged in: ${user.id}`);

    res.json({
      message: 'Login successful',
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        age: user.age,
        gender: user.gender,
        institution: user.institution
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/debug', (req, res) => {
  res.json({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? (process.env.GOOGLE_CLIENT_ID.slice(0, 10) + '...') : 'MISSING',
    GOOGLE_DRIVE_CLIENT_ID: process.env.GOOGLE_DRIVE_CLIENT_ID ? (process.env.GOOGLE_DRIVE_CLIENT_ID.slice(0, 10) + '...') : 'MISSING',
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    TIMESTAMP: new Date().toISOString()
  });
});

app.get('/api/auth/debug-drive', async (req, res) => {
  try {
    const googleDrive = require('./google-drive-manager');
    const drive = await googleDrive.authenticate();
    
    const rootName = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || 'DataCollection';
    const rootId = await googleDrive.ensureFolder(drive, rootName);
    
    res.json({
      status: 'authenticated',
      root_folder_name: rootName,
      root_folder_id: rootId,
      refresh_token_exists: !!process.env.GOOGLE_REFRESH_TOKEN,
      client_id_exists: !!process.env.GOOGLE_DRIVE_CLIENT_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'failed',
      error: error.message,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    console.log('[DEBUG] Google Auth Request Headers:', req.headers);
    console.log('[DEBUG] Token Length:', token.length);

    const currentClientId = process.env.GOOGLE_CLIENT_ID;
    logger.info(`Attempting Google Auth. Backend Client ID starts with: ${currentClientId ? currentClientId.slice(0, 10) : 'MISSING'}`);

    // Build audience array, filtering out undefined
    const audience = [
      currentClientId,
      '1090740879589-2iim3doqe1ck17l9gm77otmiakvj8vcs.apps.googleusercontent.com'
    ].filter(Boolean);

    // Allow BOTH the new backend Client ID and the original frontend Client ID
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: audience,
    });
    const payload = ticket.getPayload();
    const { email } = payload;

    logger.info(`Google Auth successful for email: ${email}. Searching in DB...`);
    
    // Check if user exists (Google users only need email lookup)
    let result = await pool.query(
      'SELECT id, email, age, gender, institution FROM users WHERE email = $1',
      [email]
    );

    logger.info(`DB lookup completed for ${email}. Found: ${result.rows.length} rows.`);

    let user;
    if (result.rows.length === 0) {
      // Create new user for Google login if not exists
      const randomPass = require('crypto').randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPass, 10);
      const insertResult = await pool.query(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, created_at`,
        [email, hashedPassword]
      );
      user = insertResult.rows[0];
      logger.info(`New user registered via Google: ${user.id}`);
    } else {
      user = result.rows[0];
    }

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'jwt-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Google login successful',
      access_token: jwtToken,
      user: user
    });
  } catch (error) {
    logger.error('Google login error detail:', {
      message: error.message,
      client_id_missing: !process.env.GOOGLE_CLIENT_ID
    });
    res.status(500).json({ error: `Google authentication failed: ${error.message}` });
  }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, age, gender, institution, consent_given FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      valid: true,
      user: result.rows[0]
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ============================================================================
// ROUTES - SURVEY
// ============================================================================

app.post('/api/survey/start', authenticateToken, async (req, res) => {
  try {
    const { assessment_type } = req.body;
    const userId = req.user.id;

    const userResult = await pool.query(
      'SELECT consent_given FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0].consent_given) {
      return res.status(400).json({ error: 'Consent required' });
    }

    const sessionId = `survey_${userId}_${Date.now()}`;

    logger.info(`Survey started for user ${userId}: ${assessment_type}`);

    res.json({
      session_id: sessionId,
      assessment_type: assessment_type || 'baseline',
      items_count: 97,
      estimated_duration_minutes: 30,
      start_time: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Survey start error:', error);
    res.status(500).json({ error: 'Failed to start survey' });
  }
});

app.post('/api/survey/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      assessment_type,
      demographics,
      social_media_usage,
      attention_focus,
      working_memory,
      problem_solving,
      academic_performance,
      digital_wellness,
      sleep_wellbeing,
      completion_time_minutes,
      device_info
    } = req.body;

    if (!assessment_type || !demographics || !social_media_usage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO survey_responses 
       (user_id, assessment_type, demographics, social_media_usage, attention_focus, 
        working_memory, problem_solving, academic_performance, digital_wellness, 
        sleep_wellbeing, completion_time_minutes, ip_address, device_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, timestamp`,
      [
        userId, assessment_type, JSON.stringify(demographics),
        JSON.stringify(social_media_usage), JSON.stringify(attention_focus),
        JSON.stringify(working_memory), JSON.stringify(problem_solving),
        JSON.stringify(academic_performance), JSON.stringify(digital_wellness),
        JSON.stringify(sleep_wellbeing), completion_time_minutes,
        req.ip, JSON.stringify(device_info || {})
      ]
    );

    const response = result.rows[0];
    logger.info(`Survey submitted for user ${userId}`);

    // Upload survey data to S3 (with retry, non-blocking)
    setImmediate(async () => {
      const s3Filename = `survey_${assessment_type}_${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}.json`;
      const s3Key = `surveys/participant-${userId}/${s3Filename}`;
      logger.info(`[S3] Attempting survey upload: s3://${s3BucketName}/${s3Key}`);
      const ok = await uploadToS3({
        Bucket: s3BucketName,
        Key: s3Key,
        Body: JSON.stringify(req.body, null, 2),
        ContentType: 'application/json'
      }, `survey(user=${userId})`);
      if (ok) logger.info(`[S3] Survey upload SUCCESS for user ${userId}`);
      else logger.error(`[S3] Survey upload FAILED after all retries for user ${userId}`);
    });

    res.status(201).json({
      message: 'Survey submitted successfully',
      response_id: response.id,
      timestamp: response.timestamp
    });
  } catch (error) {
    logger.error('Survey submission error:', error);
    res.status(500).json({ error: 'Failed to submit survey' });
  }
});

app.get('/api/survey/progress/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT assessment_type, COUNT(*) as count, MAX(timestamp) as latest
       FROM survey_responses
       WHERE user_id = $1
       GROUP BY assessment_type`,
      [userId]
    );

    res.json({
      user_id: userId,
      surveys: result.rows
    });
  } catch (error) {
    logger.error('Survey progress error:', error);
    res.status(500).json({ error: 'Failed to retrieve progress' });
  }
});

// ============================================================================
// ROUTES - VIDEOS
// ============================================================================

app.post('/api/videos/upload', authenticateToken, upload.single('video'), async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const videoType = req.body.video_type || 'cognitive_test';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');
    
    // Robust extension detection
    const mime = (req.file.mimetype || '').toLowerCase();
    const originalName = (req.file.originalname || '').toLowerCase();
    const isWebm = mime.includes('webm') || originalName.endsWith('.webm');
    const extension = isWebm ? 'webm' : 'mp4';
    
    const finalFilename = `${videoType}_${timestamp}.${extension}`;
    const s3Key = `videos/participant-${userId}/${finalFilename}`;
    const fileSizeMB = req.file.size / (1024 * 1024);

    let finalFilePath = req.file.path;

    // ── Fix WebM Metadata (Re-mux using FFmpeg) ────────────────────────
    if (isWebm) {
      const fixedPath = req.file.path + '_fixed.webm';
      try {
        logger.info(`[FFmpeg] Fixing WebM metadata for: ${req.file.originalname}`);
        // '-c copy' is fast and lossless (no re-encoding), fixes the header
        await execPromise(`ffmpeg -i "${req.file.path}" -c copy "${fixedPath}"`);
        finalFilePath = fixedPath;
        logger.info(`[FFmpeg] Metadata fixed successfully.`);
      } catch (err) {
        logger.error(`[FFmpeg] Failed to fix metadata (using raw file): ${err.message}`);
        // Fallback to original file
        finalFilePath = req.file.path;
      }
    }

    let videoUrl = '';
    let storageType = 'local';

    // ── Upload to S3 (primary) ──────────────────────────────────────────
    const fs = require('fs');
    logger.info(`[S3] Attempting video upload: s3://${s3BucketName}/${s3Key}`);
    try {
      const params = {
        Bucket: s3BucketName,
        Key: s3Key,
        Body: fs.createReadStream(finalFilePath),
        ContentType: isWebm ? 'video/webm' : 'video/mp4'
      };
      await s3.upload(params).promise();
      videoUrl = `https://${s3BucketName}.s3.${s3Config.region}.amazonaws.com/${s3Key}`;
      storageType = 's3';
      logger.info(`[S3] Video uploaded SUCCESS: ${s3Key} (${fileSizeMB.toFixed(2)} MB)`);
    } catch (s3Err) {
      // ── Fallback to local filesystem ─────────────────────────────────────
      logger.error('[S3] Video upload failed, saving locally:', s3Err.message);
      const path = require('path');
      const uploadsDir = path.join(__dirname, 'uploads', 'videos');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const localFilePath = path.join(uploadsDir, filename);
      fs.renameSync(req.file.path, localFilePath);
      videoUrl = `/uploads/videos/${filename}`;
      storageType = 'local';
    }

    // CLEANUP: Delete the temp files
    if (fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) logger.error('Failed to delete temp video file:', err);
      });
    }
    if (finalFilePath !== req.file.path && fs.existsSync(finalFilePath)) {
      fs.unlink(finalFilePath, (err) => {
        if (err) logger.error('Failed to delete fixed video file:', err);
      });
    }

    const result = await pool.query(
      `INSERT INTO video_metadata 
       (user_id, video_type, s3_bucket, s3_key, s3_url, file_size_mb, upload_status, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING id, s3_key, file_size_mb`,
      [
        userId,
        videoType,
        storageType === 's3' ? s3BucketName : 'local',
        s3Key,
        videoUrl,
        fileSizeMB,
        'completed'
      ]
    );

    const video = result.rows[0];
    logger.info(`Video saved for user ${userId} via ${storageType}`);

    res.status(201).json({
      message: `Video uploaded successfully (${storageType})`,
      video_id: video.id,
      storage: storageType,
      video_url: videoUrl,
      file_size_mb: video.file_size_mb
    });
  } catch (error) {
    logger.error('Video upload error:', error);
    res.status(500).json({ error: 'Video upload failed: ' + error.message });
  }
});

app.get('/api/videos/list/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT id, video_type, s3_key, file_size_mb, duration_seconds, upload_status, analysis_status, created_at
       FROM video_metadata
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      user_id: userId,
      videos: result.rows
    });
  } catch (error) {
    logger.error('List videos error:', error);
    res.status(500).json({ error: 'Failed to list videos' });
  }
});

// ============================================================================
// ROUTES - FACIAL ANALYSIS
// ============================================================================

app.post('/api/facial/analyze', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { video_id } = req.body;

    if (!video_id) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    const videoResult = await pool.query(
      'SELECT id FROM video_metadata WHERE id = $1 AND user_id = $2',
      [video_id, userId]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await pool.query(
      'UPDATE video_metadata SET analysis_status = $1 WHERE id = $2',
      ['processing', video_id]
    );

    logger.info(`Facial analysis queued for video ${video_id}`);

    res.status(202).json({
      message: 'Facial analysis queued',
      video_id: video_id,
      status: 'processing'
    });
  } catch (error) {
    logger.error('Facial analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

app.get('/api/facial/results/:videoId', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user.id;

    const videoResult = await pool.query(
      'SELECT id FROM video_metadata WHERE id = $1 AND user_id = $2',
      [videoId, userId]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const result = await pool.query(
      `SELECT id, dominant_emotion, stress_level, anxiety_probability, blink_rate, timestamp
       FROM facial_analysis_results
       WHERE video_id = $1`,
      [videoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'no_results',
        message: 'Analysis not yet completed'
      });
    }

    res.json({
      video_id: videoId,
      results: result.rows
    });
  } catch (error) {
    logger.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to retrieve results' });
  }
});

// ============================================================================
// ROUTES - COGNITIVE TESTS
// ============================================================================

app.post('/api/tests/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { test_type, raw_score, standardized_score, percentile, performance_data } = req.body;

    if (!test_type || raw_score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO cognitive_test_results 
       (user_id, test_type, raw_score, standardized_score, percentile, performance_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, test_type, raw_score, standardized_score, percentile`,
      [userId, test_type, raw_score, standardized_score, percentile, JSON.stringify(performance_data || {})]
    );

    logger.info(`Cognitive test submitted for user ${userId}: ${test_type}`);

    // Upload test results to S3 (with retry, non-blocking)
    setImmediate(async () => {
      const s3Filename = `test_${test_type}_${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}.json`;
      const s3Key = `tests/participant-${userId}/${s3Filename}`;
      logger.info(`[S3] Attempting test upload: s3://${s3BucketName}/${s3Key}`);
      const ok = await uploadToS3({
        Bucket: s3BucketName,
        Key: s3Key,
        Body: JSON.stringify(req.body, null, 2),
        ContentType: 'application/json'
      }, `test(user=${userId},type=${test_type})`);
      if (ok) logger.info(`[S3] Test upload SUCCESS for user ${userId}, type=${test_type}`);
      else logger.error(`[S3] Test upload FAILED after all retries for user ${userId}, type=${test_type}`);
    });

    res.status(201).json({
      message: 'Test result submitted successfully',
      result: result.rows[0]
    });
  } catch (error) {
    logger.error('Test submission error:', error);
    res.status(500).json({ error: 'Failed to submit test result' });
  }
});

app.get('/api/tests/results/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT test_type, raw_score, standardized_score, percentile, timestamp
       FROM cognitive_test_results
       WHERE user_id = $1
       ORDER BY timestamp DESC`,
      [userId]
    );

    res.json({
      user_id: userId,
      tests: result.rows
    });
  } catch (error) {
    logger.error('Get test results error:', error);
    res.status(500).json({ error: 'Failed to retrieve test results' });
  }
});

// ============================================================================
// ROUTES - ADMIN
// ============================================================================

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const userCountResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const surveyCountResult = await pool.query('SELECT COUNT(*) as count FROM survey_responses');
    const videoCountResult = await pool.query('SELECT COUNT(*) as count FROM video_metadata');
    const baselineResult = await pool.query(
      'SELECT COUNT(*) as count FROM survey_responses WHERE assessment_type = $1',
      ['baseline']
    );
    const followupResult = await pool.query(
      'SELECT COUNT(*) as count FROM survey_responses WHERE assessment_type = $1',
      ['3-month']
    );

    const totalUsers = parseInt(userCountResult.rows[0].count);
    const totalSurveys = parseInt(surveyCountResult.rows[0].count);
    const totalVideos = parseInt(videoCountResult.rows[0].count);
    const baselineCount = parseInt(baselineResult.rows[0].count);
    const followupCount = parseInt(followupResult.rows[0].count);

    res.json({
      total_users: totalUsers,
      total_surveys: totalSurveys,
      total_videos: totalVideos,
      baseline_surveys: baselineCount,
      followup_surveys: followupCount,
      completion_rate: totalUsers > 0 ? `${((totalSurveys / (totalUsers * 3)) * 100).toFixed(1)}%` : '0%'
    });
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(403).json({ error: 'Dashboard access denied' });
  }
});

app.get('/api/admin/export/:dataType', authenticateToken, async (req, res) => {
  try {
    const { dataType } = req.params;

    let query = '';
    let filename = '';

    if (dataType === 'surveys') {
      query = 'SELECT * FROM survey_responses ORDER BY timestamp DESC';
      filename = `surveys_export_${new Date().toISOString().slice(0, 10)}.json`;
    } else if (dataType === 'tests') {
      query = 'SELECT * FROM cognitive_test_results ORDER BY timestamp DESC';
      filename = `cognitive_tests_export_${new Date().toISOString().slice(0, 10)}.json`;
    } else if (dataType === 'videos') {
      query = 'SELECT * FROM video_metadata ORDER BY created_at DESC';
      filename = `videos_export_${new Date().toISOString().slice(0, 10)}.json`;
    } else {
      return res.status(400).json({ error: 'Invalid data type' });
    }

    const result = await pool.query(query);
    const jsonContent = JSON.stringify(result.rows, null, 2);

    // Upload export to S3 for backup
    let s3Info = null;
    try {
      const s3Key = `exports/${filename}`;
      const params = {
        Bucket: s3BucketName,
        Key: s3Key,
        Body: jsonContent,
        ContentType: 'application/json'
      };
      await s3.upload(params).promise();
      s3Info = {
        bucket: s3BucketName,
        key: s3Key,
        url: `https://${s3BucketName}.s3.${s3Config.region}.amazonaws.com/${s3Key}`
      };
      logger.info(`[S3] Export uploaded: ${s3Key}`);
    } catch (s3Err) {
      logger.error('[S3] Failed to upload export:', s3Err.message);
      // Non-fatal: still return the download as normal
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Include S3 metadata in response headers if available
    if (s3Info) {
      res.setHeader('X-S3-Bucket', s3Info.bucket);
      res.setHeader('X-S3-Key', s3Info.key);
    }

    res.json({
      data: result.rows,
      ...(s3Info ? {
        s3_backup: {
          bucket: s3Info.bucket,
          key: s3Info.key,
          url: s3Info.url
        }
      } : {})
    });
  } catch (error) {
    logger.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ============================================================================
// ROUTES - HEALTH
// ============================================================================

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');

    let s3Status = 'unknown';
    try {
      await s3.headBucket({ Bucket: s3BucketName }).promise();
      s3Status = 'connected';
    } catch (s3Error) {
      s3Status = `error: ${s3Error.code || s3Error.message}`;
      logger.warn('[health] S3 not available:', s3Error.message);
    }

    res.json({
      status: isLocalDb ? 'healthy-local' : 'healthy',
      database: isLocalDb ? 'local-fallback' : 'connected',
      s3: s3Status,
      s3_bucket: s3BucketName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (isLocalDb) {
       return res.json({
          status: 'healthy-local',
          database: 'local-fallback',
          s3: 'unknown',
          timestamp: new Date().toISOString()
       });
    }
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ── S3 diagnostic endpoint — use to verify credentials & bucket in production ──
app.get('/api/debug/s3', async (req, res) => {
  const result = {
    bucket: s3BucketName,
    region: s3Config.region,
    credentialSource: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
      ? 'env-variables'
      : 'iam-role-or-default-chain',
    accessKeyIdPresent: !!process.env.AWS_ACCESS_KEY_ID,
    secretKeyPresent: !!process.env.AWS_SECRET_ACCESS_KEY,
    tests: {}
  };

  // 1 — headBucket (checks bucket exists + access)
  try {
    await s3.headBucket({ Bucket: s3BucketName }).promise();
    result.tests.headBucket = 'PASS';
  } catch (e) {
    result.tests.headBucket = `FAIL: ${e.code} — ${e.message}`;
  }

  // 2 — putObject (checks write permission)
  const testKey = `_diagnostics/s3-write-test-${Date.now()}.txt`;
  try {
    await s3.putObject({
      Bucket: s3BucketName,
      Key: testKey,
      Body: 'S3 write test',
      ContentType: 'text/plain'
    }).promise();
    result.tests.putObject = 'PASS';

    // 3 — deleteObject (clean up the test file)
    try {
      await s3.deleteObject({ Bucket: s3BucketName, Key: testKey }).promise();
      result.tests.deleteObject = 'PASS';
    } catch (e) {
      result.tests.deleteObject = `FAIL: ${e.code}`;
    }
  } catch (e) {
    result.tests.putObject = `FAIL: ${e.code} — ${e.message}`;
    result.tests.deleteObject = 'SKIPPED';
  }

  const allPassed = Object.values(result.tests).every(v => v === 'PASS');
  res.status(allPassed ? 200 : 500).json({ ...result, overall: allPassed ? 'OK' : 'FAILED' });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// SERVER START
// ============================================================================

const startServer = async () => {
  await initializeDatabase();

  // ── S3 startup connectivity check ─────────────────────────────────────────
  console.log(`\n⏳ Checking S3 connectivity (bucket: ${s3BucketName}, region: ${s3Config.region})...`);
  try {
    await s3.headBucket({ Bucket: s3BucketName }).promise();
    console.log('✓ S3 bucket reachable — uploads will work.');
    logger.info('[S3] Startup check passed.');
  } catch (s3Err) {
    // Non-fatal: app still starts, but log a very clear warning
    console.error(`\n⚠️  S3 STARTUP CHECK FAILED — uploads will fail!`);
    console.error(`   Error code : ${s3Err.code}`);
    console.error(`   Message    : ${s3Err.message}`);
    if (s3Err.code === 'CredentialsError' || s3Err.code === 'InvalidClientTokenId') {
      console.error('   ► Fix: Attach an IAM role to this EC2 instance with S3 write permission,');
      console.error('          OR set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY in backend/.env');
    } else if (s3Err.code === 'NoSuchBucket') {
      console.error(`   ► Fix: Create the S3 bucket "${s3BucketName}" in region ${s3Config.region}`);
    } else if (s3Err.code === 'AccessDenied') {
      console.error(`   ► Fix: The IAM role/user lacks s3:HeadBucket + s3:PutObject on "${s3BucketName}"`);
    }
    console.error('   ► Diagnostic URL: GET /api/debug/s3\n');
    logger.error('[S3] Startup check failed:', { code: s3Err.code, message: s3Err.message });
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ API health check: http://localhost:${PORT}/api/health`);
    console.log(`✓ S3 diagnostic  : http://localhost:${PORT}/api/debug/s3`);
    console.log(`✓ DB pool size: ${parseInt(process.env.DB_POOL_SIZE) || 5}`);
  });

  // Graceful shutdown for PM2 on AWS
  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      pool.end().then(() => {
        logger.info('Database pool closed.');
        process.exit(0);
      });
    });
    // Force close after 5 seconds
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;