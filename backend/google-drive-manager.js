// ============================================================================
// backend/google-drive-manager.js
// Google Drive API helper for uploading videos and data exports
// Uses a Service Account for server-to-server authentication (no user login)
// ============================================================================

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

/**
 * Authenticate using a Google Service Account.
 *
 * Two modes (automatically detected):
 *  - LOCAL DEV:  reads key from the file at GOOGLE_SERVICE_ACCOUNT_KEY_PATH
 *  - RENDER/PROD: reads key JSON from GOOGLE_SERVICE_ACCOUNT_KEY_JSON env var
 */
async function authenticate() {
    let credentials;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
        // Render / production: key is stored as a JSON string env var
        try {
            credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
        } catch (e) {
            console.warn('GOOGLE_SERVICE_ACCOUNT_KEY_JSON is not valid JSON, trying file fallback...');
            // Fall through to file-based detection below
        }
    }

    if (!credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
        // Local dev: key is stored in a file
        const resolvedPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
        if (fs.existsSync(resolvedPath)) {
            credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        }
    }

    // Auto-detect: scan backend directory for any service account key file
    if (!credentials) {
        const backendDir = __dirname;
        const files = fs.readdirSync(backendDir);
        const keyFile = files.find(f =>
            f.endsWith('.json') &&
            f !== 'package.json' &&
            f !== 'package-lock.json' &&
            f !== 'local_data.json'
        );
        if (keyFile) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(backendDir, keyFile), 'utf8'));
                if (content.type === 'service_account' && content.private_key) {
                    credentials = content;
                    console.log(`Auto-detected service account key file: ${keyFile}`);
                }
            } catch (e) {
                // Not a valid key file, ignore
            }
        }
    }

    if (!credentials) {
        throw new Error(
            'Google Drive auth: no valid service account key found. ' +
            'Set GOOGLE_SERVICE_ACCOUNT_KEY_JSON, GOOGLE_SERVICE_ACCOUNT_KEY_PATH, ' +
            'or place a service account key .json file in the backend directory.'
        );
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });
    return drive;
}

/**
 * Find or create a Drive folder by name under an optional parent folder.
 * Returns the folder's Drive ID.
 */
async function ensureFolder(drive, folderName, parentId = null) {
    // Search for existing folder
    const query = [
        `name = '${folderName}'`,
        `mimeType = 'application/vnd.google-apps.folder'`,
        `trashed = false`,
        parentId ? `'${parentId}' in parents` : null,
    ]
        .filter(Boolean)
        .join(' and ');

    const res = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (res.data.files.length > 0) {
        return res.data.files[0].id;
    }

    // Create folder if it doesn't exist
    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
    };

    const folder = await drive.files.create({
        resource: fileMetadata,
        fields: 'id',
    });

    return folder.data.id;
}

/**
 * Get the root folder ID for uploads.
 * If GOOGLE_DRIVE_ROOT_FOLDER_ID is set (e.g. a shared folder from personal account),
 * use that directly. Otherwise, find or create a folder by name.
 */
async function getRootFolderId(drive) {
    if (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
        return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    }
    const rootName = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || 'DataCollection';
    return ensureFolder(drive, rootName);
}

/**
 * Upload a Buffer to Google Drive inside the specified folder.
 * Returns { fileId, driveUrl }
 */
async function uploadFile(drive, { name, mimeType, buffer, folderId }) {
    const stream = Readable.from(buffer);

    const fileMetadata = {
        name,
        parents: folderId ? [folderId] : [],
    };

    const media = {
        mimeType,
        body: stream,
    };

    const file = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id, webViewLink, webContentLink',
    });

    return {
        fileId: file.data.id,
        driveUrl: file.data.webViewLink,
        downloadUrl: file.data.webContentLink,
    };
}

/**
 * Make a Drive file publicly readable (anyone with the link can view).
 */
async function makePublic(drive, fileId) {
    await drive.permissions.create({
        fileId,
        resource: {
            role: 'reader',
            type: 'anyone',
        },
    });
}

/**
 * High-level helper: upload a video Buffer to Drive.
 * Folder structure: <ROOT> / videos / participant-<userId> / <filename>
 *
 * @param {Buffer} buffer  - Video file buffer
 * @param {string} filename - e.g. "cognitive_test_20250228T123456.mp4"
 * @param {number|string} userId - Participant user ID
 * @returns {{ fileId, driveUrl, downloadUrl }}
 */
async function uploadVideo(buffer, filename, userId) {
    const drive = await authenticate();

    const rootId = await getRootFolderId(drive);
    const videosId = await ensureFolder(drive, 'videos', rootId);
    const userFolderId = await ensureFolder(drive, `participant-${userId}`, videosId);

    const result = await uploadFile(drive, {
        name: filename,
        mimeType: 'video/mp4',
        buffer,
        folderId: userFolderId,
    });

    await makePublic(drive, result.fileId);
    return result;
}

/**
 * High-level helper: upload a JSON data export to Drive.
 * Folder structure: <ROOT> / exports / <filename>
 *
 * @param {string} jsonContent - Stringified JSON
 * @param {string} filename    - e.g. "surveys_export_20250228.json"
 * @returns {{ fileId, driveUrl, downloadUrl }}
 */
async function uploadExport(jsonContent, filename) {
    const drive = await authenticate();

    const rootId = await getRootFolderId(drive);
    const exportsId = await ensureFolder(drive, 'exports', rootId);

    const buffer = Buffer.from(jsonContent, 'utf8');

    const result = await uploadFile(drive, {
        name: filename,
        mimeType: 'application/json',
        buffer,
        folderId: exportsId,
    });

    await makePublic(drive, result.fileId);
    return result;
}

/**
 * High-level helper: upload generic user data (JSON) to Drive.
 * Folder structure: <ROOT> / <category> / participant-<userId> / <filename>
 *
 * @param {object|string} data - Data to upload
 * @param {string} filename   - e.g. "survey_baseline_20250228.json"
 * @param {number|string} userId - Participant user ID
 * @param {string} category   - e.g. "surveys" or "tests"
 * @returns {{ fileId, driveUrl }}
 */
async function uploadUserData(data, filename, userId, category) {
    const drive = await authenticate();

    const rootId = await getRootFolderId(drive);
    const categoryId = await ensureFolder(drive, category, rootId);
    const userFolderId = await ensureFolder(drive, `participant-${userId}`, categoryId);

    const jsonContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf8');

    const result = await uploadFile(drive, {
        name: filename,
        mimeType: 'application/json',
        buffer,
        folderId: userFolderId,
    });

    await makePublic(drive, result.fileId);
    return result;
}

module.exports = {
    authenticate,
    ensureFolder,
    uploadFile,
    makePublic,
    uploadVideo,
    uploadExport,
    uploadUserData,
};
