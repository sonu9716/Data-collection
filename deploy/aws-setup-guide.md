# 🚀 AWS Free Tier Setup Guide — Data Collection Platform

> **Goal:** Deploy the platform to handle **50 concurrent users** for **$0/month** using AWS Free Tier.

---

## 📋 Prerequisites

- [ ] AWS account (within 12-month free tier window)
- [ ] GitHub repo with your code pushed
- [ ] AWS CLI installed on your local machine
- [ ] Google OAuth credentials (already configured)
- [ ] Google Drive refresh token (already configured)

---

## 🏗️ Architecture Overview

```
Users (50) ──→ S3 Static Website (React Frontend)
            ──→ EC2 t2.micro (Nginx → Node.js Backend)
                    ↓
              RDS db.t3.micro (PostgreSQL)
              Google Drive (Video Storage)
```

| Component | AWS Service | Free Tier Limit |
|-----------|------------|-----------------|
| Frontend | S3 Static Website | 5GB, 20K GET/month |
| Backend | EC2 t2.micro | 750 hrs/month, 1 vCPU, 1GB RAM |
| Database | RDS db.t3.micro | 750 hrs/month, 20GB storage |
| Videos | Google Drive | 15GB free per Google account |

---

## Step 1: Create RDS PostgreSQL Database

1. Go to **AWS Console → RDS → Create Database**
2. Choose:
   - **Engine:** PostgreSQL 16
   - **Template:** Free Tier ⚠️ (select this!)
   - **DB Instance Identifier:** `data-collection-db`
   - **Master Username:** `postgres`
   - **Master Password:** (set a strong password, save it!)
   - **Instance class:** `db.t3.micro` (free tier eligible)
   - **Storage:** 20 GB gp2
   - **Public access:** ❌ No (only EC2 should connect)
   - **VPC:** Default VPC

3. Under **Additional Configuration:**
   - **Initial database name:** `data_collection`
   - **Backup retention:** 1 day (keeps backups small)
   - **Auto minor version upgrade:** ✅ Yes

4. Click **Create Database** — takes 5-10 minutes.

5. **Save the endpoint** — you'll need it for `.env`:
   ```
   data-collection-db.xxxxxxxxxxxx.ap-south-1.rds.amazonaws.com
   ```

6. **Security Group:** Edit the RDS security group:
   - Add inbound rule: **PostgreSQL (5432)** from your **EC2 security group**

---

## Step 2: Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Configure:
   - **Name:** `data-collection-api`
   - **AMI:** Ubuntu 24.04 LTS (free tier eligible)
   - **Instance type:** `t2.micro` (free tier) — 1 vCPU, 1GB RAM
   - **Key pair:** Create new or use existing (download the .pem file!)
   - **Network:** Default VPC
   - **Security Group:** Create new with these rules:

     | Type | Port | Source |
     |------|------|--------|
     | SSH | 22 | Your IP (or 0.0.0.0/0) |
     | HTTP | 80 | 0.0.0.0/0 |
     | HTTPS | 443 | 0.0.0.0/0 |

   - **Storage:** 8 GB gp3 (free tier allows up to 30GB)

3. Click **Launch Instance**

4. **Allocate Elastic IP:**
   - Go to **EC2 → Elastic IPs → Allocate**
   - **Associate** it with your instance
   - Save this IP — it's your permanent backend address

---

## Step 3: Create S3 Bucket for Frontend

1. Go to **AWS Console → S3 → Create Bucket**
2. Configure:
   - **Bucket name:** `data-collection-frontend-<unique-id>` (must be globally unique)
   - **Region:** `ap-south-1` (same as EC2)
   - **Uncheck** "Block all public access" ⚠️
   - Acknowledge the warning

3. **Enable Static Website Hosting:**
   - Go to bucket → **Properties** → **Static website hosting** → **Enable**
   - Index document: `index.html`
   - Error document: `index.html` (for React Router)

4. **Set Bucket Policy** (allow public read):
   - Go to bucket → **Permissions** → **Bucket Policy** → Paste:
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
   Replace `YOUR-BUCKET-NAME` with your actual bucket name.

5. **Your frontend URL will be:**
   ```
   http://YOUR-BUCKET-NAME.s3-website.ap-south-1.amazonaws.com
   ```

---

## Step 4: SSH into EC2 and Run Setup

```bash
# SSH into your instance
ssh -i "your-key.pem" ubuntu@YOUR_ELASTIC_IP

# Download and run setup script
git clone https://github.com/YOUR_USERNAME/Data-collection.git /home/ubuntu/data-collection
cd /home/ubuntu/data-collection
chmod +x deploy/setup-ec2.sh
sudo ./deploy/setup-ec2.sh
```

The script will:
- ✅ Update system packages
- ✅ Create 1GB swap file (critical for 1GB RAM)
- ✅ Install Node.js 20.x
- ✅ Install Nginx + PM2
- ✅ Install Certbot for SSL
- ✅ Configure firewall
- ✅ Install backend dependencies
- ✅ Configure Nginx reverse proxy
- ✅ Set up log rotation

---

## Step 5: Configure Environment Variables

```bash
# Copy the template
cp /home/ubuntu/data-collection/deploy/.env.aws.example /home/ubuntu/data-collection/backend/.env

# Edit with your values
nano /home/ubuntu/data-collection/backend/.env
```

**Fill in these values:**

| Variable | Where to Get It |
|----------|----------------|
| `DATABASE_URL` | RDS endpoint from Step 1 |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `GOOGLE_REFRESH_TOKEN` | From your existing backend/.env |
| `CORS_ORIGINS` | Your S3 website URL from Step 3 |

**Example DATABASE_URL:**
```
postgresql://postgres:MyStr0ngP@ss@data-collection-db.abcdef123456.ap-south-1.rds.amazonaws.com:5432/data_collection
```

---

## Step 6: Start the Backend

```bash
cd /home/ubuntu/data-collection

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start deploy/ecosystem.config.js

# Verify it's running
pm2 status
pm2 logs data-collection-api --lines 20

# Save PM2 process list (survives reboot)
pm2 save

# Set PM2 to start on boot
pm2 startup
# ↑ Run the command it prints!

# Check health endpoint
curl http://localhost/api/health
```

**Expected output:**
```json
{"status":"healthy","database":"connected","timestamp":"2026-04-04T..."}
```

---

## Step 7: Deploy Frontend to S3

**Run this from your LOCAL machine** (not EC2):

```bash
cd Data-collection

# Edit deploy script with your values
# 1. Set S3_BUCKET to your bucket name
# 2. Set API_URL to http://YOUR_ELASTIC_IP/api

nano deploy/deploy-frontend.sh

# Run the deploy
chmod +x deploy/deploy-frontend.sh
./deploy/deploy-frontend.sh
```

---

## Step 8: Update Google OAuth Origins

1. Go to **Google Cloud Console → APIs & Credentials → OAuth 2.0 Client IDs**
2. Edit your client ID
3. Add to **Authorized JavaScript origins:**
   ```
   http://YOUR-BUCKET-NAME.s3-website.ap-south-1.amazonaws.com
   ```
4. Add to **Authorized redirect URIs:**
   ```
   http://YOUR-BUCKET-NAME.s3-website.ap-south-1.amazonaws.com
   ```

---

## Step 9: Set Up Billing Alerts (IMPORTANT!)

1. Go to **AWS Console → Billing → Budgets → Create Budget**
2. Choose **Cost budget**
3. Set budget amount: **$1.00** (alerts before any real charges)
4. Add notification: **Alert at 80%** → your email
5. Add notification: **Alert at 100%** → your email

---

## Step 10: (Optional) Enable HTTPS with Domain

If you have a domain name:

```bash
# SSH into EC2
# Point your domain's A record to the Elastic IP first

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Certbot auto-renews. Verify:
sudo certbot renew --dry-run
```

---

## ✅ Verification Checklist

After setup, test everything:

- [ ] `curl http://ELASTIC_IP/api/health` → `{"status":"healthy"}`
- [ ] Open S3 frontend URL in browser → login page loads
- [ ] Register a new user → success
- [ ] Google Sign-In works
- [ ] Complete survey → data saved
- [ ] Cognitive tests run and submit
- [ ] Video records and uploads to Google Drive
- [ ] Admin dashboard shows stats
- [ ] Check `pm2 status` → online, no restarts
- [ ] Check `free -h` → memory usage reasonable

---

## 📊 Monitoring Commands

```bash
# Check app status
pm2 status

# Watch live logs
pm2 logs data-collection-api

# Check memory usage
free -h

# Check disk usage
df -h

# Check CPU usage
top -bn1 | head -5

# Check Nginx status
systemctl status nginx

# Check RDS connections (from app logs)
pm2 logs data-collection-api | grep "pool"
```

---

## 🆘 Troubleshooting

### App crashes / restarts
```bash
# Check error logs
pm2 logs data-collection-api --err --lines 50

# Check if it's memory
free -h
# If swap is heavily used, reduce DB_POOL_SIZE to 3 in .env
```

### Cannot connect to RDS
```bash
# Test from EC2:
psql -h YOUR_RDS_ENDPOINT -U postgres -d data_collection

# If connection refused:
# 1. Check RDS security group allows port 5432 from EC2
# 2. Check RDS is in same VPC as EC2
# 3. Check RDS is "Available" status in console
```

### Frontend not loading
```bash
# Check S3 bucket is public
# Check static website hosting is enabled
# Check index document is "index.html"
# Check error document is "index.html"
```

### CORS errors
```bash
# Update CORS_ORIGINS in backend/.env
# Restart: pm2 restart data-collection-api
```

### Video upload fails
```bash
# Check Google Drive credentials
curl http://ELASTIC_IP/api/auth/debug-drive

# Check disk space (temp uploads)
df -h /tmp
```

---

## 💰 Cost Summary

| Service | Monthly Cost |
|---------|-------------|
| EC2 t2.micro | $0 (free tier) |
| RDS db.t3.micro | $0 (free tier) |
| S3 (5GB) | $0 (free tier) |
| Elastic IP (attached) | $0 |
| EBS 8GB gp3 | $0 (free tier) |
| Data Transfer (< 100GB) | $0 |
| Google Drive (15GB) | $0 |
| **Total** | **$0/month** |

> ⚠️ Free Tier expires 12 months after AWS account creation. Set billing alerts!
