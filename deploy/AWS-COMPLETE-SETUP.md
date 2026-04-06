# 🚀 Complete AWS Setup — Click-by-Click Guide

> **Starting point:** You have signed up for AWS and verified your account.
> **End result:** Platform running at $0/month, serving 50 concurrent users.
> **Estimated time:** 45-60 minutes.

---

## 📌 Before You Begin

Make sure you have:
- [x] AWS account signed up and verified
- [x] Credit/debit card added (required by AWS, you won't be charged)
- [x] Your project code pushed to GitHub
- [x] Your Google OAuth credentials (already in your .env)
- [x] Your Google Drive refresh token (already in your .env)

**Your GitHub repo URL:** `https://github.com/YOUR_USERNAME/Data-collection.git`

**📝 Write-down sheet — fill these in as you go:**
```
Elastic IP:           ___.___.___.___ 
Render DATABASE_URL:  (copy from Render Dashboard)
S3 Bucket Name:       ________________
S3 Website URL:       http://________________.s3-website.ap-south-1.amazonaws.com
AWS Access Key ID:    ________________
AWS Secret Key:       ________________
```

---

# PART A: AWS CONSOLE SETUP

---

## Step 1: Set Your Region

1. Log in to **AWS Console**: https://console.aws.amazon.com
2. Look at the **top-right corner** — you'll see a region name (e.g., "N. Virginia")
3. Click it → Select **Asia Pacific (Mumbai) — ap-south-1**
   - This gives the lowest latency if your users are in India
   - All free tier services work in this region

> ⚠️ **IMPORTANT:** Make sure EVERY service you create is in **ap-south-1**. If you accidentally create something in another region, you'll have two separate environments.

---

## Step 2: Launch EC2 Instance (Your Backend Server)

This is the main thing — your backend server. The key pair and security group are created right here during launch.

1. Go to **Services** → **EC2** → Click **Launch instance** (big orange button)

2. **Name and tags:**
   - Name: `data-collection-api`

3. **Application and OS Images (AMI):**
   - Click **Ubuntu**
   - Select: **Ubuntu Server 24.04 LTS (HVM), SSD Volume Type**
   - Architecture: **64-bit (x86)**
   - It should show: **"Free tier eligible"** ✅

4. **Instance type:**
   - Select: **t2.micro** (Free tier eligible)
   - It shows: 1 vCPU, 1 GiB Memory

5. **Key pair (login):** — Creating here itself
   - Click **Create new key pair**
   - Name: `data-collection-key`
   - Key pair type: **RSA**
   - Private key file format: `.pem`
   - Click **Create key pair**
   - ⬇️ **It will auto-download** `data-collection-key.pem` — **SAVE THIS FILE!**
   - Move it to: `C:\Users\sonus\.ssh\data-collection-key.pem`

> 🔐 **You can NEVER download this key again.** If you lose it, you can't SSH into your server.

6. **Network settings:** — Creating security group here itself
   - Click **Edit**
   - **VPC:** Default
   - **Subnet:** No preference
   - **Auto-assign Public IP:** ✅ Enable
   - **Firewall (security groups):** ✅ **Create security group**
   - **Security group name:** `data-collection-sg`
   - **Description:** `Security group for data collection platform`
   - It already has SSH (port 22) → Change **Source type** to **My IP**
   - Click **Add security group rule** → Add these:

     | Type | Port Range | Source type | Source |
     |------|-----------|-------------|--------|
     | SSH | 22 | My IP | (auto-filled) |
     | HTTP | 80 | Anywhere | 0.0.0.0/0 |
     | HTTPS | 443 | Anywhere | 0.0.0.0/0 |

7. **Configure storage:**
   - **Size:** `8` GiB
   - **Volume type:** gp3
   - (Free tier allows up to 30 GiB)

8. **Summary panel (right side):**
   - Number of instances: **1**
   - Verify: t2.micro, Ubuntu 24.04, 8 GiB, your key pair

9. Click **Launch instance** 🚀

10. Click **View all instances** — wait for **Instance state** to show **Running** (1-2 minutes)

✅ **Done!** EC2 instance is running with key pair and security group created.

---

## Step 3: Allocate an Elastic IP (Permanent Address)

Without this, your EC2's IP changes every time you restart it. Elastic IP gives a fixed address.

1. Still in **EC2** → Left sidebar → **Elastic IPs** (under "Network & Security")
2. Click **Allocate Elastic IP address**
3. Leave all defaults → Click **Allocate**
4. You'll see your new IP (e.g., `13.234.56.78`)
5. **Select it** (checkbox) → Click **Actions** → **Associate Elastic IP address**
6. Fill in:
   - **Resource type:** Instance
   - **Instance:** Select `data-collection-api`
   - **Private IP address:** Leave default
7. Click **Associate**

> 📝 **Write down your Elastic IP:** `___.___.___.___`
> This is your backend's permanent address forever.

> ⚠️ **WARNING:** An Elastic IP is free ONLY when associated with a RUNNING instance. If you stop the instance without releasing the IP, you'll be charged ~$3.65/month.

---

## Step 4: Get Your Render PostgreSQL Connection URL

You already have a free PostgreSQL database on Render — no need to create anything on AWS!

1. Go to **Render Dashboard**: https://dashboard.render.com
2. Click on your database: **data-collection-db**
3. Scroll to **Connections** section
4. Copy the **External Database URL** — it looks like:
   ```
   postgresql://postgres:xxxxxxxxxxxx@dpg-xxxxx.oregon-postgres.render.com:5432/data_collection
   ```

> 📝 **Copy your Render DATABASE_URL** — you'll paste it in Step 8.

> 💡 **Why Render DB + AWS EC2?** Render gives you a free PostgreSQL database (no RAM impact on your server). AWS EC2 runs only Node.js + Nginx, leaving plenty of RAM for 50 users. Best of both worlds!

---

## Step 5: Create S3 Bucket (Frontend Hosting)

1. Go to **Services** → **S3**
2. Click **Create bucket**

3. **General configuration:**
   - Bucket name: `data-collection-frontend-<your-unique-id>`
     - Example: `data-collection-frontend-sonus2026`
     - ⚠️ Must be globally unique across ALL of AWS!
   - Region: **ap-south-1** (should already be selected)

4. **Object Ownership:**
   - ✅ ACLs disabled (recommended)

5. **Block Public Access settings:**
   - ❌ **UNCHECK** "Block all public access"
   - A warning will appear — ✅ Check "I acknowledge that..."

6. **Versioning:** ❌ Disable (not needed)
7. Leave everything else as default

8. Click **Create bucket**

9. **Enable Static Website Hosting:**
   - Click on your bucket name to open it
   - Go to **Properties** tab
   - Scroll down to **Static website hosting** → Click **Edit**
   - ✅ **Enable**
   - Hosting type: **Host a static website**
   - Index document: `index.html`
   - Error document: `index.html`   ← IMPORTANT for React Router!
   - Click **Save changes**

10. **Set Bucket Policy** (so people can view your frontend):
    - Go to **Permissions** tab
    - Scroll to **Bucket policy** → Click **Edit**
    - Paste this JSON (replace `YOUR-BUCKET-NAME`):

    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "PublicReadGetObject",
          "Effect": "Allow",
          "Principal": "*",
          "Action": "s3:GetObject",
          "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        }
      ]
    }
    ```
    - Click **Save changes**

11. Go back to **Properties** → Scroll to **Static website hosting** → Copy the **Bucket website endpoint:**
    ```
    http://data-collection-frontend-sonus2026.s3-website.ap-south-1.amazonaws.com
    ```

> 📝 **Write down your S3 Website URL:** `________________________________`

---

## Step 6: Set Up Billing Alert (NEVER SKIP THIS!)

> ⚠️ This protects you from surprise charges. Takes 1 minute.

1. Go to **Services** → Search **"Budgets"** → Click **AWS Budgets**
2. Click **Create a budget**
3. Choose **Cost budget — Recommended**
4. Fill in:
   - Budget name: `free-tier-alert`
   - Budget amount: `1.00` (USD)
   - ✅ Alert at 80% → Your email
   - ✅ Alert at 100% → Your email
5. Click **Create budget**

> ✅ You'll now get an email if AWS is about to charge you more than $0.80.

---

# PART B: SERVER SETUP (SSH into EC2)

---

## Step 7: Connect to Your EC2 Instance

### On Windows (PowerShell):

```powershell
# Create .ssh directory if it doesn't exist
mkdir -Force "$HOME\.ssh"

# Move the key file (if still in Downloads)
Move-Item "$HOME\Downloads\data-collection-key.pem" "$HOME\.ssh\data-collection-key.pem" -ErrorAction SilentlyContinue

# Fix permissions (required for SSH)
icacls "$HOME\.ssh\data-collection-key.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"

# Connect to EC2 (replace YOUR_ELASTIC_IP with your actual IP)
ssh -i "$HOME\.ssh\data-collection-key.pem" ubuntu@YOUR_ELASTIC_IP
```

**Type `yes`** when asked about fingerprint, then you should see:
```
Welcome to Ubuntu 24.04 LTS
ubuntu@ip-172-31-xx-xx:~$
```

> 💡 **Can't connect?** Check: (1) EC2 is "Running", (2) Security group has SSH port 22 from "My IP", (3) You're using the correct Elastic IP.

---

## Step 8: Run the Automated Setup Script

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/Data-collection.git /home/ubuntu/data-collection

# Go to the project folder
cd /home/ubuntu/data-collection

# Make setup script executable and run it
chmod +x deploy/setup-ec2.sh
sudo ./deploy/setup-ec2.sh
```

**This installs everything automatically (3-5 minutes):**
- ✅ System updates
- ✅ 1GB swap file (doubles usable memory — critical for 1GB machine!)
- ✅ Node.js 20.x
- ✅ Nginx reverse proxy
- ✅ PM2 process manager
- ✅ Certbot (SSL)
- ✅ UFW firewall
- ✅ Backend npm dependencies
- ✅ Log rotation

You'll see green `[STEP]` messages as it progresses.

---

## Step 9: Configure Environment Variables

```bash
# Copy the template
cp /home/ubuntu/data-collection/deploy/.env.aws.example /home/ubuntu/data-collection/backend/.env

# Generate a random JWT secret
openssl rand -hex 32
# ↑ Copy the output — you'll paste it below

# Edit the .env file
nano /home/ubuntu/data-collection/backend/.env
```

**Fill in YOUR values:**

```env
# --- Server ---
PORT=5000
NODE_ENV=production
JWT_SECRET=PASTE_THE_RANDOM_STRING_FROM_ABOVE

# --- Database (paste your Render External Database URL from Step 4) ---
DATABASE_URL=postgresql://postgres:xxxx@dpg-xxxxx.oregon-postgres.render.com:5432/data_collection

# --- Pool ---
DB_POOL_SIZE=5

# --- Google OAuth (no change needed) ---
GOOGLE_CLIENT_ID=1090740879589-2iim3doqe1ck17l9gm77otmiakvj8vcs.apps.googleusercontent.com

# --- Google Drive (copy from your local backend/.env) ---
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_CLIENT_ID=YOUR_GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET=YOUR_GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN=YOUR_GOOGLE_REFRESH_TOKEN
GOOGLE_DRIVE_ROOT_FOLDER_NAME=DataCollection

# --- CORS (paste your S3 website URL from Step 5) ---
CORS_ORIGINS=http://YOUR-S3-WEBSITE-URL,http://localhost:3000
```

> ⚠️ **The DATABASE_URL must be the EXTERNAL URL** from Render, not the internal one!

**Save and exit:** Press `Ctrl + X` → `Y` → `Enter`

---

## Step 10: Start the Backend

```bash
cd /home/ubuntu/data-collection

# Create logs directory
mkdir -p logs

# Start the app with PM2
pm2 start deploy/ecosystem.config.js

# Check it's running
pm2 status
```

**Expected output:**
```
┌─────┬──────────────────────────┬──────┬────┬───────┬──────────┐
│ id  │ name                     │ mode │ ↺  │ status│ memory   │
├─────┼──────────────────────────┼──────┼────┼───────┼──────────┤
│ 0   │ data-collection-api      │ fork │ 0  │ online│ 85.0mb   │
└─────┴──────────────────────────┴──────┴────┴───────┴──────────┘
```

```bash
# Check for errors in logs
pm2 logs data-collection-api --lines 20
```

**You should see:**
```
✓ Server running on http://localhost:5000
✓ API health check: http://localhost:5000/api/health
✓ DB pool size: 5
Database initialized successfully
```

```bash
# Test health endpoint
curl http://localhost/api/health
```

**Expected:**
```json
{"status":"healthy","database":"connected","timestamp":"2026-04-04T..."}
```

**Backend is running!** 🎉 Now make it survive reboots:

```bash
# Save the process list
pm2 save

# Make PM2 start on boot
pm2 startup
# ↑ It will print a command — COPY AND RUN that command!
```

---

## Step 11: Test from Your Browser

Open your browser and go to:
```
http://YOUR_ELASTIC_IP/api/health
```

You should see: `{"status":"healthy","database":"connected",...}`

✅ **Your backend is live on the internet!**

---

# PART C: DEPLOY FRONTEND (from your local Windows machine)

---

## Step 12: Create AWS Access Key (for CLI uploads)

1. Go to **AWS Console** → Click your **account name** (top right) → **Security credentials**
2. Scroll to **Access keys** → Click **Create access key**
3. Select **Command Line Interface (CLI)**
4. ✅ Check the confirmation → Click **Next** → Click **Create access key**
5. **COPY BOTH VALUES** — the Secret is shown only once!

> 📝 **Write down:**
> - Access Key ID: `____________________`
> - Secret Access Key: `____________________`

---

## Step 13: Install & Configure AWS CLI

**Download:** https://aws.amazon.com/cli/ → Install the MSI for Windows

Open a **new PowerShell** window:
```powershell
# Verify installation
aws --version

# Configure with your access key
aws configure
```

It will ask:
```
AWS Access Key ID [None]: PASTE_YOUR_ACCESS_KEY
AWS Secret Access Key [None]: PASTE_YOUR_SECRET
Default region name [None]: ap-south-1
Default output format [None]: json
```

---

## Step 14: Build and Upload Frontend to S3

```powershell
cd C:\Users\sonus\Documents\Data-collection\frontend

# Set the backend API URL (use your Elastic IP)
$env:REACT_APP_API_URL = "http://YOUR_ELASTIC_IP/api"
$env:REACT_APP_GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"

# Build the React app
npm run build

# Upload static assets to S3 (long cache — filenames have hashes)
aws s3 sync build/ s3://YOUR-BUCKET-NAME/ --delete --cache-control "public, max-age=31536000" --exclude "index.html" --exclude "manifest.json" --region ap-south-1

# Upload index.html (no cache — always get latest)
aws s3 cp build/index.html s3://YOUR-BUCKET-NAME/index.html --cache-control "no-cache, no-store, must-revalidate" --region ap-south-1

# Upload manifest.json (no cache)
aws s3 cp build/manifest.json s3://YOUR-BUCKET-NAME/manifest.json --cache-control "no-cache" --region ap-south-1
```

> Replace `YOUR-BUCKET-NAME` and `YOUR_ELASTIC_IP` with your actual values!

---

## Step 15: Update Google OAuth Origins

1. Go to **Google Cloud Console**: https://console.cloud.google.com
2. Go to **APIs & Services** → **Credentials**
3. Click on your **OAuth 2.0 Client ID**
4. Add your S3 URL to **Authorized JavaScript origins:**
   ```
   http://YOUR-BUCKET-NAME.s3-website.ap-south-1.amazonaws.com
   ```
5. Add the same to **Authorized redirect URIs**
6. Click **Save**

> ⚠️ Google OAuth changes can take **5-10 minutes** to propagate.

---

## Step 16: Open Your Platform! 🎉

Open your browser and go to your S3 Website URL:
```
http://YOUR-BUCKET-NAME.s3-website.ap-south-1.amazonaws.com
```

**You should see the Login/Register page!**

---

# PART D: VERIFICATION

---

## Step 17: Test All Features

| # | Test | How | ✅ Expected |
|---|------|-----|------------|
| 1 | Health check | `http://ELASTIC_IP/api/health` | `{"status":"healthy"}` |
| 2 | Frontend loads | Visit S3 URL | Login page appears |
| 3 | Register user | Fill form + click Register | Success message |
| 4 | Login | Enter email/password | Redirected to Welcome |
| 5 | Google Sign-In | Click Google button | Login works |
| 6 | Give consent | On Welcome page | Proceeds to Dashboard |
| 7 | Complete survey | Fill out 107 items | Submitted successfully |
| 8 | Cognitive tests | Complete 5 tests | Scores saved |
| 9 | Video recording | Allow camera + record | Uploaded to Google Drive |
| 10 | Admin dashboard | Visit `/admin` | Shows user stats |

---

## Step 18: Monitor Your Server

SSH into EC2 and run:
```bash
pm2 status              # App running?
free -h                 # Memory OK?
df -h                   # Disk space?
pm2 logs --lines 10     # Recent logs
pm2 monit               # Live dashboard (Ctrl+C to exit)
```

---

# 📋 QUICK REFERENCE CARD

```
╔═══════════════════════════════════════════════════════════╗
║  DATA COLLECTION PLATFORM — AWS DEPLOYMENT               ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Frontend:   http://BUCKET.s3-website.ap-south-1...       ║
║  Backend:    http://ELASTIC_IP/api                        ║
║  Health:     http://ELASTIC_IP/api/health                 ║
║  SSH:        ssh -i ~/.ssh/data-collection-key.pem        ║
║                    ubuntu@ELASTIC_IP                      ║
║                                                           ║
║  On EC2:                                                  ║
║    pm2 status / pm2 logs / pm2 restart all / free -h      ║
║                                                           ║
║  Redeploy Frontend (your PC):                             ║
║    npm run build                                          ║
║    aws s3 sync build/ s3://BUCKET/ --delete               ║
║                                                           ║
║  Update Backend (EC2):                                    ║
║    git pull && cd backend && npm i --production           ║
║    pm2 restart data-collection-api                        ║
║                                                           ║
║  Monthly Cost: $0 (Free Tier)                             ║
║  Capacity: 50 concurrent users                            ║
╚═══════════════════════════════════════════════════════════╝
```

---

# 🆘 TROUBLESHOOTING

### "Connection refused" when visiting Elastic IP
```bash
pm2 status                  # Is the app running?
sudo systemctl status nginx # Is nginx running?
sudo nginx -t               # Any config errors?
```

### "502 Bad Gateway"
```bash
pm2 logs --err              # Check Node.js errors
free -h                     # Out of memory?
```

### "CORS error" in browser
```bash
nano /home/ubuntu/data-collection/backend/.env
# → Add your S3 URL to CORS_ORIGINS
pm2 restart data-collection-api
```

### RDS "connection refused"
```bash
psql -h YOUR_RDS_ENDPOINT -U postgres -d data_collection
# If fail: check security group allows port 5432 from itself
```

### Camera doesn't work
- `getUserMedia` requires HTTPS or localhost
- Fix: Get a domain + free SSL with `sudo certbot --nginx -d yourdomain.com`
- Workaround for testing: `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → add your S3 URL

### Out of memory
```bash
free -h                     # Check swap usage
# Reduce pool: edit .env → DB_POOL_SIZE=3
pm2 restart data-collection-api
```

### Disk full
```bash
df -h
pm2 flush                   # Clear logs
sudo journalctl --vacuum-time=2d
```

---

# 🔄 DAILY OPERATIONS

### Update Backend Code
```bash
cd /home/ubuntu/data-collection
git pull origin main
cd backend && npm install --production
pm2 restart data-collection-api
```

### Update Frontend
```powershell
cd C:\Users\sonus\Documents\Data-collection\frontend
$env:REACT_APP_API_URL = "http://YOUR_ELASTIC_IP/api"
npm run build
aws s3 sync build/ s3://YOUR-BUCKET-NAME/ --delete --region ap-south-1
aws s3 cp build/index.html s3://YOUR-BUCKET-NAME/index.html --cache-control "no-cache" --region ap-south-1
```

### View Collected Data
```bash
# On EC2:
psql -h YOUR_RDS_ENDPOINT -U postgres -d data_collection
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM survey_responses;
SELECT COUNT(*) FROM video_metadata;
\q
```

### Export Data
- Visit `http://your-s3-url/admin` → Click Export buttons

---

# ✅ YOU'RE DONE!

Your data collection platform is now live:
- **50 concurrent users** supported
- **$0/month** on AWS Free Tier
- Surveys, cognitive tests, video recording — all working
- Data in PostgreSQL (RDS) + Google Drive
- Auto-restart on crash (PM2)
- 1GB swap as memory safety net

**Share your S3 website URL with participants and start collecting data!** 🚀
