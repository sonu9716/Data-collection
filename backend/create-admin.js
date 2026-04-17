// create-admin.js
// Run this once to create the admin user:
//   node create-admin.js

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = 'admin@datacollection.com';
const ADMIN_PASSWORD = 'Admin@2026!';
const DATA_FILE = path.join(__dirname, 'local_data.json');

async function createAdmin() {
  // Load existing data
  let data = { users: [], survey_responses: [], cognitive_test_results: [], video_metadata: [], facial_analysis_results: [] };
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  // Check if admin already exists
  const exists = data.users.find(u => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (exists) {
    console.log(`\n⚠️  Admin user already exists (id: ${exists.id})`);
    console.log(`   Email   : ${ADMIN_EMAIL}`);
    return;
  }

  // Hash the password
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const adminUser = {
    id: data.users.length + 1,
    email: ADMIN_EMAIL,
    password_hash: passwordHash,
    age: null,
    gender: null,
    institution: 'Admin',
    socioeconomic_status: null,
    academic_discipline: null,
    consent_given: true,
    is_admin: true,
    created_at: new Date().toISOString()
  };

  data.users.push(adminUser);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  console.log('\n✅ Admin user created successfully!');
  console.log('─'.repeat(40));
  console.log(`   Email   : ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   User ID : ${adminUser.id}`);
  console.log('─'.repeat(40));
  console.log('\n   Use these credentials to log in to the frontend.\n');
}

createAdmin().catch(err => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
