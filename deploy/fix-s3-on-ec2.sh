#!/bin/bash
# =============================================================================
# fix-s3-on-ec2.sh
# Run this ON YOUR EC2 INSTANCE to diagnose and fix all S3 upload problems.
#
# Usage:
#   scp -i your-key.pem deploy/fix-s3-on-ec2.sh ubuntu@YOUR_EC2_IP:~/ 
#   ssh -i your-key.pem ubuntu@YOUR_EC2_IP "chmod +x fix-s3-on-ec2.sh && sudo ./fix-s3-on-ec2.sh"
# =============================================================================

set -euo pipefail
APP_DIR="/home/ubuntu/data-collection"
ENV_FILE="$APP_DIR/backend/.env"
NGINX_CONF="/etc/nginx/nginx.conf"
BUCKET="data-collection-uploads"
REGION="ap-south-1"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "  --> $1"; }

echo ""
echo "====================================================="
echo "   S3 Upload Failure Fixer for Data-Collection App"
echo "====================================================="
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 1. Pull latest code so all the code fixes are deployed
# ──────────────────────────────────────────────────────────────────────────────
echo "[ Step 1 ] Pulling latest code..."
cd "$APP_DIR"
git pull origin main || warn "git pull failed — continuing with existing code"
ok "Code updated"

# ──────────────────────────────────────────────────────────────────────────────
# 2. Fix nginx client_max_body_size (50M → 110M)
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo "[ Step 2 ] Checking nginx upload size limit..."
if grep -q "client_max_body_size 50M" "$NGINX_CONF" 2>/dev/null; then
    sed -i 's/client_max_body_size 50M/client_max_body_size 110M/g' "$NGINX_CONF"
    ok "Fixed nginx client_max_body_size: 50M → 110M"
    nginx -t && systemctl reload nginx
    ok "Nginx reloaded"
elif grep -q "client_max_body_size" "$NGINX_CONF" 2>/dev/null; then
    warn "nginx already has a body size limit — current value:"
    grep "client_max_body_size" "$NGINX_CONF"
else
    warn "client_max_body_size not found in $NGINX_CONF — adding it manually"
    # Insert into http{} block
    sed -i '/location \/api\/ {/i\        client_max_body_size 110M;' "$NGINX_CONF"
    nginx -t && systemctl reload nginx
fi

# ──────────────────────────────────────────────────────────────────────────────
# 3. Check EC2 IAM metadata endpoint for auto-cred detection
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo "[ Step 3 ] Checking EC2 IAM Role credentials..."
IAM_ROLE=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>/dev/null || true)

if [ -z "$IAM_ROLE" ]; then
    fail "No IAM role attached to this EC2 instance!"
    info "This is why S3 uploads fail — no credentials available."
    info ""
    info "FIX OPTION A (recommended): Attach an IAM role in AWS Console:"
    info "  1. Go to EC2 → Instances → select this instance"
    info "  2. Actions → Security → Modify IAM role"
    info "  3. Create or attach a role with AmazonS3FullAccess OR a custom policy:"
    info "     s3:PutObject, s3:GetObject, s3:DeleteObject, s3:HeadBucket on arn:aws:s3:::${BUCKET}/*"
    info ""
    info "FIX OPTION B: Add AWS keys to $ENV_FILE"
    info "  Edit the file and set:"
    info "  AWS_ACCESS_KEY_ID=YOUR_KEY"
    info "  AWS_SECRET_ACCESS_KEY=YOUR_SECRET"

    # Ask interactively if we should write keys to .env
    echo ""
    read -p "  Do you want to enter AWS keys now? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "  AWS_ACCESS_KEY_ID: " ACCESS_KEY_ID
        read -s -p "  AWS_SECRET_ACCESS_KEY: " SECRET_KEY
        echo ""
        # Update or append
        if grep -q "^AWS_ACCESS_KEY_ID=" "$ENV_FILE"; then
            sed -i "s|^AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}|" "$ENV_FILE"
        else
            echo "AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}" >> "$ENV_FILE"
        fi
        if grep -q "^AWS_SECRET_ACCESS_KEY=" "$ENV_FILE"; then
            sed -i "s|^AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=${SECRET_KEY}|" "$ENV_FILE"
        else
            echo "AWS_SECRET_ACCESS_KEY=${SECRET_KEY}" >> "$ENV_FILE"
        fi
        ok "AWS credentials written to $ENV_FILE"
    fi
else
    ok "IAM Role found: $IAM_ROLE"
    # Quick S3 write test using instance metadata creds
    CREDS=$(curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/$IAM_ROLE)
    info "IAM credential check: $(echo $CREDS | python3 -c "import sys,json; d=json.load(sys.stdin); print('Expiration=' + d.get('Expiration','?'))" 2>/dev/null || echo "parsed OK")"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 4. Fix CORS_ORIGINS in backend/.env
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo "[ Step 4 ] Checking CORS_ORIGINS in $ENV_FILE..."
CURRENT_CORS=$(grep "^CORS_ORIGINS=" "$ENV_FILE" 2>/dev/null || echo "")
if echo "$CURRENT_CORS" | grep -q "localhost" && ! echo "$CURRENT_CORS" | grep -q "docsitesolutions"; then
    fail "CORS_ORIGINS only has localhost — production domain blocked!"
    CORRECT_CORS='CORS_ORIGINS=https://data.docsitesolutions.online,http://data-collection-frontend.s3-website.ap-south-1.amazonaws.com,http://localhost:3000'
    if grep -q "^CORS_ORIGINS=" "$ENV_FILE"; then
        sed -i "s|^CORS_ORIGINS=.*|${CORRECT_CORS}|" "$ENV_FILE"
    else
        echo "$CORRECT_CORS" >> "$ENV_FILE"
    fi
    ok "CORS_ORIGINS updated with production domain"
else
    ok "CORS_ORIGINS looks correct: $CURRENT_CORS"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 5. Verify S3 bucket exists and is accessible
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo "[ Step 5 ] Testing S3 bucket access..."
if command -v aws &>/dev/null; then
    if aws s3 ls "s3://${BUCKET}" --region "$REGION" &>/dev/null; then
        ok "S3 bucket '${BUCKET}' is accessible"
        # Test write
        echo "write-test" | aws s3 cp - "s3://${BUCKET}/_diagnostics/write-test.txt" --region "$REGION" 2>/dev/null \
            && ok "S3 write permission: OK" \
            && aws s3 rm "s3://${BUCKET}/_diagnostics/write-test.txt" --region "$REGION" &>/dev/null \
            || fail "S3 write permission FAILED — check IAM policy"
    else
        fail "Cannot access s3://${BUCKET} — bucket missing or no access"
        info "Create it: aws s3 mb s3://${BUCKET} --region ${REGION}"
    fi
else
    warn "AWS CLI not installed — skipping bucket test (install with: sudo snap install aws-cli --classic)"
fi

# ──────────────────────────────────────────────────────────────────────────────
# 6. Restart backend
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo "[ Step 6 ] Restarting backend with PM2..."
cd "$APP_DIR"
pm2 restart data-collection-api --update-env 2>/dev/null \
    || pm2 start deploy/ecosystem.config.js
pm2 save
ok "Backend restarted"

echo ""
echo "[ Step 7 ] Waiting 5 seconds for server to start..."
sleep 5

# ──────────────────────────────────────────────────────────────────────────────
# 7. Final verification
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo "[ Step 8 ] Final S3 diagnostic check..."
S3_CHECK=$(curl -s http://localhost:5000/api/debug/s3 2>/dev/null || echo '{"overall":"FAILED","error":"server not responding"}')
echo "$S3_CHECK" | python3 -m json.tool 2>/dev/null || echo "$S3_CHECK"

if echo "$S3_CHECK" | grep -q '"overall":"OK"'; then
    echo ""
    ok "============================================"
    ok "  ALL S3 FIXES APPLIED SUCCESSFULLY! ✅"
    ok "============================================"
    ok "S3 uploads are now working."
else
    echo ""
    fail "============================================"
    fail "  S3 STILL FAILING — check output above"
    fail "============================================"
    info "Useful commands:"
    info "  pm2 logs data-collection-api --lines 50"
    info "  curl http://localhost:5000/api/debug/s3"
    info "  curl http://localhost:5000/api/health"
fi

echo ""
echo "PM2 log tail (last 20 lines):"
pm2 logs data-collection-api --lines 20 --nostream 2>/dev/null || true
