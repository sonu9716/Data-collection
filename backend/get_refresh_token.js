const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');

// ============================================================================
// INSTRUCTIONS:
// 1. Go to Google Cloud Console -> APIs & Services -> Credentials
// 2. Create Credentials -> OAuth client ID
// 3. Application type: Desktop app
// 4. Copy the Client ID and Client Secret below:
// ============================================================================

const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET_HERE';

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/drive'];

if (CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
  console.error("❌ Please edit this file and paste your CLIENT_ID and CLIENT_SECRET first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

async function main() {
  // Generate auth url
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent to ensure we get a refresh token
  });

  console.log('\n======================================================');
  console.log('Opening browser to authorize with your Google account...');
  console.log('If the browser does not open, click this link:');
  console.log(authorizeUrl);
  console.log('======================================================\n');

  try {
    const openModule = await import('open');
    openModule.default(authorizeUrl);
  } catch (err) {
    console.log("Could not open browser automatically.");
  }

  // Create simple local server to receive the callback
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);
      if (parsedUrl.pathname === '/oauth2callback') {
        const code = parsedUrl.query.code;
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication successful!</h1><p>You can close this window and check your terminal.</p>');
          server.close();
          
          console.log('\n✅ Authorization code received! Fetching tokens...\n');
          
          const { tokens } = await oauth2Client.getToken(code);
          
          console.log('======================================================');
          console.log('🎉 SUCCESS! Here is the data for your Render Environment Variables:');
          console.log('======================================================\n');
          
          console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
          console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
          console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
          
          console.log('======================================================');
          console.log('Delete the "GOOGLE_SERVICE_ACCOUNT_KEY_JSON" variable from Render.');
          console.log('Add the three variable above to your Render Environment.');
          console.log('======================================================\n');
          
          process.exit(0);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Authentication failed: No code provided');
          server.close();
          process.exit(1);
        }
      }
    } catch (e) {
      console.error(e);
      server.close();
      process.exit(1);
    }
  }).listen(3000, () => {
    console.log('Waiting for authorization callback on port 3000...');
  });
}

main().catch(console.error);
