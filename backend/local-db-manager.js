const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LocalDB {
    constructor() {
        this.dataFile = path.join(__dirname, 'local_data.json');
        this.data = {
            users: [],
            survey_responses: [],
            cognitive_test_results: [],
            video_metadata: [],
            facial_analysis_results: []
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.dataFile)) {
                this.data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
            }
        } catch (err) {
            console.error('Failed to load local data:', err);
        }
    }

    save() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error('Failed to save local data:', err);
        }
    }

    async query(text, params = []) {
        const sql = text.trim().toLowerCase();

        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            // 0. INITIALIZATION NOISE (Silently handle schema queries)
            if (sql.startsWith('create table') || sql.startsWith('create index') || sql === 'select now()') {
                return { rows: [sql === 'select now()' ? { now: new Date().toISOString() } : {}] };
            }

            // 1. REGISTER: INSERT INTO users
            if (sql.startsWith('insert into users')) {
                const newUser = {
                    id: this.data.users.length + 1,
                    email: params[0],
                    password_hash: params[1],
                    age: params[2],
                    gender: params[3],
                    institution: params[4],
                    socioeconomic_status: params[5],
                    academic_discipline: params[6],
                    consent_given: true,
                    created_at: new Date().toISOString()
                };
                this.data.users.push(newUser);
                this.save();
                return { rows: [newUser] };
            }

            // 2. CHECK EMAIL / LOGIN: SELECT ... FROM users WHERE email
            if (sql.includes('from users where email =')) {
                const user = this.data.users.find(u => u.email === params[0]);
                return { rows: user ? [user] : [] };
            }

            // 3. VERIFY / GET USER: SELECT ... FROM users WHERE id
            if (sql.includes('from users where id =')) {
                const user = this.data.users.find(u => u.id === parseInt(params[0]));
                return { rows: user ? [user] : [] };
            }

            // 4. SUBMIT SURVEY: INSERT INTO survey_responses
            if (sql.startsWith('insert into survey_responses')) {
                const newResponse = {
                    id: this.data.survey_responses.length + 1,
                    user_id: params[0],
                    assessment_type: params[1],
                    demographics: JSON.parse(params[2] || '{}'),
                    social_media_usage: JSON.parse(params[3] || '{}'),
                    attention_focus: JSON.parse(params[4] || '{}'),
                    working_memory: JSON.parse(params[5] || '{}'),
                    problem_solving: JSON.parse(params[6] || '{}'),
                    academic_performance: JSON.parse(params[7] || '{}'),
                    digital_wellness: JSON.parse(params[8] || '{}'),
                    sleep_wellbeing: JSON.parse(params[9] || '{}'),
                    completion_time_minutes: params[10],
                    ip_address: params[11],
                    device_info: JSON.parse(params[12] || '{}'),
                    timestamp: new Date().toISOString()
                };
                this.data.survey_responses.push(newResponse);
                this.save();
                return { rows: [newResponse] };
            }

            // 5. SURVEY PROGRESS: SELECT ... FROM survey_responses WHERE user_id
            if (sql.includes('from survey_responses') && sql.includes('where user_id =')) {
                const userId = parseInt(params[0]);
                // Group by assessment_type
                const counts = {};
                this.data.survey_responses
                    .filter(r => r.user_id === userId)
                    .forEach(r => {
                        if (!counts[r.assessment_type]) {
                            counts[r.assessment_type] = { assessment_type: r.assessment_type, count: 0, latest: r.timestamp };
                        }
                        counts[r.assessment_type].count++;
                        if (r.timestamp > counts[r.assessment_type].latest) {
                            counts[r.assessment_type].latest = r.timestamp;
                        }
                    });
                return { rows: Object.values(counts) };
            }

            // 6. UPLOAD VIDEO: INSERT INTO video_metadata
            if (sql.startsWith('insert into video_metadata')) {
                const newVideo = {
                    id: this.data.video_metadata.length + 1,
                    user_id: params[0],
                    video_type: params[1],
                    s3_bucket: params[2],
                    s3_key: params[3],
                    s3_url: params[4],
                    file_size_mb: params[5],
                    upload_status: params[6],
                    created_at: new Date().toISOString()
                };
                this.data.video_metadata.push(newVideo);
                this.save();
                return { rows: [newVideo] };
            }

            // 7. LIST VIDEOS: SELECT ... FROM video_metadata
            if (sql.includes('from video_metadata') && sql.includes('where user_id =')) {
                const videos = this.data.video_metadata
                    .filter(v => v.user_id === parseInt(params[0]))
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                return { rows: videos };
            }

            // 8. COGNITIVE TEST: INSERT INTO cognitive_test_results
            if (sql.startsWith('insert into cognitive_test_results')) {
                const newTest = {
                    id: this.data.cognitive_test_results.length + 1,
                    user_id: params[0],
                    test_type: params[1],
                    raw_score: params[2],
                    standardized_score: params[3],
                    percentile: params[4],
                    performance_data: JSON.parse(params[5] || '{}'),
                    timestamp: new Date().toISOString()
                };
                this.data.cognitive_test_results.push(newTest);
                this.save();
                return { rows: [newTest] };
            }

            // 9. LIST TESTS: SELECT ... FROM cognitive_test_results
            if (sql.includes('from cognitive_test_results') && sql.includes('where user_id =')) {
                const tests = this.data.cognitive_test_results
                    .filter(t => t.user_id === parseInt(params[0]))
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                return { rows: tests };
            }

            // 10. ADMIN COUNTS
            if (sql.includes('select count(*)')) {
                if (sql.includes('from users')) return { rows: [{ count: this.data.users.length }] };
                if (sql.includes('from survey_responses')) {
                    if (sql.includes('assessment_type =')) {
                        const type = params[0];
                        const count = this.data.survey_responses.filter(r => r.assessment_type === type).length;
                        return { rows: [{ count }] };
                    }
                    return { rows: [{ count: this.data.survey_responses.length }] };
                }
                if (sql.includes('from video_metadata')) return { rows: [{ count: this.data.video_metadata.length }] };
            }

            // Default
            console.log('LocalDB: Unhandled query:', sql);
            return { rows: [] };

        } catch (err) {
            console.error('LocalDB Error:', err);
            throw err;
        }
    }
}

module.exports = new LocalDB();
