#!/bin/bash
# ============================================================================
# EC2 Server Setup Script for Data-Collection Platform
# Optimized for AWS Free Tier t2.micro (1 vCPU, 1GB RAM)
# Supports 50 concurrent users
#
# Run this on a fresh Ubuntu 22.04/24.04 EC2 t2.micro instance
#
# Usage: 
#   chmod +x setup-ec2.sh
#   sudo ./setup-ec2.sh
# ============================================================================

set -e  # Exit on any error

echo "============================================"
echo "  Data-Collection Platform - EC2 Setup"
echo "  Optimized for Free Tier (50 users)"
echo "============================================"

# --- Color codes for output ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_step() { echo -e "${GREEN}[STEP]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# STEP 1: System Update
# ============================================================================
print_step "1/10 - Updating system packages..."
apt update -y && apt upgrade -y

# ============================================================================
# STEP 2: Create Swap File (CRITICAL for 1GB RAM)
# ============================================================================
print_step "2/10 - Creating 1GB swap file..."
if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Optimize swap usage — only use when RAM is nearly full
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo "Swap file created and activated (1GB)."
else
    print_warn "Swap file already exists. Skipping."
fi

# Verify
echo "Memory status:"
free -h

# ============================================================================
# STEP 3: Install Node.js 20.x (LTS)
# ============================================================================
print_step "3/10 - Installing Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# ============================================================================
# STEP 4: Install Nginx
# ============================================================================
print_step "4/10 - Installing Nginx..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx
echo "Nginx installed and started."

# ============================================================================
# STEP 5: Install PM2 globally
# ============================================================================
print_step "5/10 - Installing PM2 process manager..."
npm install -g pm2
echo "PM2 version: $(pm2 -v)"

# ============================================================================
# STEP 6: Install Certbot (Let's Encrypt SSL)
# ============================================================================
print_step "6/10 - Installing Certbot for SSL..."
apt install -y certbot python3-certbot-nginx
echo "Certbot installed. Run 'sudo certbot --nginx' after setting up your domain."

# ============================================================================
# STEP 7: Configure Firewall (UFW)
# ============================================================================
print_step "7/10 - Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "Firewall configured: SSH + HTTP + HTTPS allowed."

# ============================================================================
# STEP 8: Clone repo and install dependencies
# ============================================================================
print_step "8/10 - Setting up application directory..."

APP_DIR="/home/ubuntu/data-collection"

if [ -d "$APP_DIR" ]; then
    print_warn "Directory $APP_DIR already exists. Pulling latest changes..."
    cd "$APP_DIR"
    git pull origin main || git pull origin master
else
    echo ""
    echo "==> Enter your GitHub repository URL:"
    echo "    Example: https://github.com/yourusername/Data-collection.git"
    read -p "    Git URL: " GIT_URL
    
    if [ -z "$GIT_URL" ]; then
        print_error "No Git URL provided. You'll need to clone manually later."
        mkdir -p "$APP_DIR"
    else
        git clone "$GIT_URL" "$APP_DIR"
    fi
fi

cd "$APP_DIR"

# Create logs directory
mkdir -p "$APP_DIR/logs"

# Install backend dependencies only (frontend is served from S3)
print_step "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --production
echo "Backend dependencies installed."

# ============================================================================
# STEP 9: Configure Nginx
# ============================================================================
print_step "9/10 - Configuring Nginx reverse proxy..."

# Back up default config
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak

# Copy our optimized config (this is a full nginx.conf, not just a site)
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/nginx.conf

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx
echo "Nginx configured and reloaded."

# ============================================================================
# STEP 10: Setup Log Rotation (prevent disk filling up)
# ============================================================================
print_step "10/10 - Setting up log rotation..."

cat > /etc/logrotate.d/data-collection << 'EOF'
/home/ubuntu/data-collection/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
    maxsize 50M
}
EOF

# Also rotate PM2 logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

echo "Log rotation configured (7 days, max 50MB per file)."

# ============================================================================
# FINAL SETUP
# ============================================================================
echo ""
echo "============================================"
echo "  Setup Complete! (Free Tier Optimized)"
echo "============================================"
echo ""
echo "System resources:"
free -h
echo ""
echo "Next steps:"
echo ""
echo "  1. Create your .env file:"
echo "     cp $APP_DIR/deploy/.env.aws.example $APP_DIR/backend/.env"
echo "     nano $APP_DIR/backend/.env"
echo ""
echo "  2. Fill in your RDS endpoint, Google Drive credentials, etc."
echo ""
echo "  3. Start the backend with PM2:"
echo "     cd $APP_DIR"
echo "     pm2 start deploy/ecosystem.config.js"
echo "     pm2 save"
echo "     pm2 startup  (follow the printed command)"
echo ""
echo "  4. (Optional) Enable HTTPS with your domain:"
echo "     sudo certbot --nginx -d yourdomain.com"
echo ""
echo "  5. Check health endpoint:"
echo "     curl http://localhost/api/health"
echo ""
echo "  6. Deploy frontend to S3:"
echo "     (from your LOCAL machine) ./deploy/deploy-frontend.sh"
echo ""
echo "============================================"
echo "  Capacity: 50 concurrent users"
echo "  RAM: 1 GB + 1 GB swap"
echo "  CPU: 1 vCPU"
echo "  Cost: \$0/month (free tier)"
echo "============================================"
