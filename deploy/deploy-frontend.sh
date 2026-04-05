#!/bin/bash
# ============================================================================
# Deploy Frontend to S3 Static Website Hosting
# Run this from your LOCAL machine (not EC2) after installing AWS CLI
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - S3 bucket created with static website hosting enabled
#   - Bucket policy allows public read access
#
# Usage:
#   chmod +x deploy/deploy-frontend.sh
#   ./deploy/deploy-frontend.sh
# ============================================================================

set -e

# ============================================================================
# CONFIGURATION - Update these values!
# ============================================================================
S3_BUCKET="data-collection-frontend"       # Your S3 bucket name
CLOUDFRONT_ID=""                           # Your CloudFront distribution ID (optional)
API_URL="http://YOUR_EC2_ELASTIC_IP/api"   # Your backend API URL (EC2 Elastic IP)
GOOGLE_CLIENT_ID="1090740879589-2iim3doqe1ck17l9gm77otmiakvj8vcs.apps.googleusercontent.com"
AWS_REGION="ap-south-1"                    # Your AWS region

# ============================================================================
# Colors
# ============================================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ============================================================================
# VALIDATION
# ============================================================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploying Frontend to AWS S3${NC}"
echo -e "${GREEN}  (Free Tier Static Hosting)${NC}"
echo -e "${GREEN}========================================${NC}"

# Check AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Install it first:${NC}"
    echo "  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check that API_URL has been configured
if [[ "$API_URL" == *"YOUR_EC2"* ]]; then
    echo -e "${RED}ERROR: Please update API_URL in this script with your EC2 Elastic IP${NC}"
    echo "  Example: API_URL=\"http://13.234.56.78/api\""
    exit 1
fi

# ============================================================================
# STEP 1: Build the React app
# ============================================================================
echo -e "\n${YELLOW}[1/3] Building React app...${NC}"
cd frontend

# Set environment variables for the build
export REACT_APP_API_URL="$API_URL"
export REACT_APP_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"

# Build produces optimized static files in frontend/build/
npm run build

echo "Build complete! Output in frontend/build/"
echo "  Size: $(du -sh build/ | cut -f1)"

# ============================================================================
# STEP 2: Sync to S3
# ============================================================================
echo -e "\n${YELLOW}[2/3] Uploading to S3 (bucket: $S3_BUCKET)...${NC}"

# Sync build folder to S3 (delete files that no longer exist)
# Static assets get long cache (1 year) since filenames contain hashes
aws s3 sync build/ "s3://$S3_BUCKET/" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "index.html" \
    --exclude "manifest.json" \
    --exclude "service-worker.js" \
    --region "$AWS_REGION"

# Upload index.html with no-cache (so users always get latest version)
aws s3 cp build/index.html "s3://$S3_BUCKET/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --region "$AWS_REGION"

# Upload manifest.json with no-cache
if [ -f build/manifest.json ]; then
    aws s3 cp build/manifest.json "s3://$S3_BUCKET/manifest.json" \
        --cache-control "no-cache" \
        --region "$AWS_REGION"
fi

echo "S3 upload complete!"

# ============================================================================
# STEP 3: Invalidate CloudFront Cache (optional)
# ============================================================================
if [ -n "$CLOUDFRONT_ID" ]; then
    echo -e "\n${YELLOW}[3/3] Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_ID" \
        --paths "/index.html" "/manifest.json" "/static/*"
    echo "CloudFront cache invalidation started."
else
    echo -e "\n${YELLOW}[3/3] Skipping CloudFront invalidation (no CLOUDFRONT_ID set)${NC}"
fi

# ============================================================================
# DONE
# ============================================================================
WEBSITE_URL="http://$S3_BUCKET.s3-website.$AWS_REGION.amazonaws.com"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Frontend deployed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Frontend URL: $WEBSITE_URL"
echo "  Backend API:  $API_URL"
echo ""
echo "  IMPORTANT: Add this URL to your backend's CORS_ORIGINS:"
echo "    CORS_ORIGINS=$WEBSITE_URL"
echo ""

cd ..
