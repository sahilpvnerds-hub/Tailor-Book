#!/bin/bash

# ============================================================================
# Tailor Book - Automated Deployment Script
# Run this script on your server after uploading the project
# ============================================================================

set -e  # Exit on error

echo "=========================================="
echo "  Tailor Book Deployment Script"
echo "=========================================="
echo ""

# Configuration
PROJECT_DIR="/var/www/tailor-book"
DOMAIN="admin-tailorbook.yiion.com"
DB_NAME="admin_tailorbook"
DB_USER="admin-tailorbook"
DB_PASS="Y!!0n1z3#"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    log_warn "Running as root. Some commands may need www-data user."
    USE_SUDO=""
else
    USE_SUDO="sudo"
    log_info "Running with sudo access"
fi

# ============================================================================
# Step 1: Install Prerequisites
# ============================================================================
echo ""
echo "--- Step 1: Installing Prerequisites ---"
log_info "Updating package lists..."
$USE_SUDO apt update -qq

log_info "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | $USE_SUDO bash - > /dev/null 2>&1
$USE_SUDO apt install -y nodejs > /dev/null 2>&1

log_info "Installing pnpm globally..."
npm install -g pnpm > /dev/null 2>&1

log_info "Installing PM2 globally..."
npm install -g pm2 > /dev/null 2>&1

log_info "Installing Nginx..."
$USE_SUDO apt install -y nginx > /dev/null 2>&1

log_info "Installing MySQL client..."
$USE_SUDO apt install -y default-mysql-client > /dev/null 2>&1

# Verify installations
NODE_VER=$(node --version)
PNPM_VER=$(pnpm --version)
PM2_VER=$(pm2 --version)
echo "  Node.js: $NODE_VER"
echo "  pnpm: $PNPM_VER"
echo "  PM2: $PM2_VER"

# ============================================================================
# Step 2: Create Project Directory
# ============================================================================
echo ""
echo "--- Step 2: Setting up Project Directory ---"

if [ ! -d "$PROJECT_DIR" ]; then
    log_info "Creating project directory..."
    $USE_SUDO mkdir -p "$PROJECT_DIR"
    $USE_SUDO chown -R $(whoami):$(whoami) "$PROJECT_DIR"
else
    log_info "Project directory already exists at $PROJECT_DIR"
fi

# ============================================================================
# Step 3: Configure Environment Variables
# ============================================================================
echo ""
echo "--- Step 3: Configuring Environment Variables ---"

# Generate JWT Secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Create API Server .env
log_info "Creating API Server environment file..."
cat > "$PROJECT_DIR/artifacts/api-server/.env" << EOF
# Backend
PORT=4000
NODE_ENV=production
LOG_LEVEL=info

# MySQL Database
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}

# Individual variables (used as fallback)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=${DB_USER}
MYSQL_PASSWORD=${DB_PASS}
MYSQL_DATABASE=${DB_NAME}

# Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=30d
EOF

# Create Mobile App .env
log_info "Creating Mobile App environment file..."
cat > "$PROJECT_DIR/artifacts/mobile/.env" << EOF
# API URL
EXPO_PUBLIC_API_URL=https://${DOMAIN}
EXPO_PUBLIC_DOMAIN=${DOMAIN}
EOF

log_info "Environment files created!"

# ============================================================================
# Step 4: Install Dependencies
# ============================================================================
echo ""
echo "--- Step 4: Installing Dependencies ---"
log_info "This may take a few minutes..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
pnpm run typecheck:libs 2>/dev/null || true

# ============================================================================
# Step 5: Build API Server
# ============================================================================
echo ""
echo "--- Step 5: Building API Server ---"
log_info "Building API server bundle..."
pnpm --filter @workspace/api-server run build
log_info "API Server built successfully!"

# ============================================================================
# Step 6: Build Mobile Web App
# ============================================================================
echo ""
echo "--- Step 6: Building Mobile Web App ---"
log_info "Building mobile web bundle... (this may take several minutes)"
pnpm --filter @workspace/mobile run build
log_info "Mobile Web App built successfully!"

# ============================================================================
# Step 7: Run Database Migrations
# ============================================================================
echo ""
echo "--- Step 7: Running Database Migrations ---"
log_info "Applying database migrations..."
pnpm --filter @workspace/lib-db run migrate 2>/dev/null || log_warn "Migrations may have already been applied or failed. Check logs."

# Seed admin user
log_info "Seeding admin user..."
cd "$PROJECT_DIR/artifacts/api-server"
pnpm exec tsx src/seed-admin.ts 2>/dev/null || log_warn "Admin seeding skipped or failed."

# ============================================================================
# Step 8: Configure PM2
# ============================================================================
echo ""
echo "--- Step 8: Configuring PM2 Process Manager ---"

# Create PM2 ecosystem file
cat > "$PROJECT_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [
    {
      name: 'tailor-book-api',
      script: 'node',
      args: '--enable-source-maps ./artifacts/api-server/dist/index.mjs',
      cwd: '${PROJECT_DIR}',
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        DATABASE_URL: 'mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}',
        JWT_SECRET: '${JWT_SECRET}',
        JWT_EXPIRES_IN: '30d',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
EOF

log_info "Starting API server with PM2..."
cd "$PROJECT_DIR"
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 startup
pm2 startup 2>/dev/null || true

log_info "PM2 configured and running!"

# ============================================================================
# Step 9: Configure Nginx
# ============================================================================
echo ""
echo "--- Step 9: Configuring Nginx ---"

# Create Nginx config
cat > /tmp/tailor-book-nginx << 'NGINXCONF'
server {
    listen 80;
    server_name admin-tailorbook.yiion.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin-tailorbook.yiion.com;

    # SSL Configuration (update paths after certbot)
    # ssl_certificate /etc/letsencrypt/live/admin-tailorbook.yiion.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/admin-tailorbook.yiion.com/privkey.pem;

    # Temporary self-signed SSL for initial setup
    ssl on;
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Mobile Web App (main frontend)
    location / {
        root /var/www/tailor-book/artifacts/mobile/static-build;
        try_files $uri $uri/ /index.html;
        index index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Server proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /healthz {
        proxy_pass http://127.0.0.1:4000/healthz;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINXCONF

$USE_SUDO cp /tmp/tailor-book-nginx /etc/nginx/sites-available/tailor-book
$USE_SUDO ln -sf /etc/nginx/sites-available/tailor-book /etc/nginx/sites-enabled/
$USE_SUDO rm -f /etc/nginx/sites-enabled/default

log_info "Testing Nginx configuration..."
$USE_SUDO nginx -t

log_info "Starting Nginx..."
$USE_SUDO systemctl enable nginx
$USE_SUDO systemctl restart nginx

# ============================================================================
# Step 10: Setup Firewall
# ============================================================================
echo ""
echo "--- Step 10: Setting up Firewall ---"
$USE_SUDO ufw --force enable
$USE_SUDO ufw allow ssh
$USE_SUDO ufw allow http
$USE_SUDO ufw allow https
$USE_SUDO ufw reload
log_info "Firewall configured!"

# ============================================================================
# Step 11: Verify Deployment
# ============================================================================
echo ""
echo "--- Step 11: Verifying Deployment ---"

# Check PM2
log_info "Checking PM2 status..."
pm2 status

# Check if API is responding
log_info "Testing API health..."
sleep 2
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/healthz 2>/dev/null || echo "000")
if [ "$API_HEALTH" = "200" ] || [ "$API_HEALTH" = "401" ]; then
    log_info "API Server is running! (HTTP $API_HEALTH)"
else
    log_warn "API Server returned HTTP $API_HEALTH"
fi

# Check static build exists
if [ -d "$PROJECT_DIR/artifacts/mobile/static-build" ]; then
    log_info "Mobile web build found!"
else
    log_error "Mobile web build not found!"
fi

# ============================================================================
# Complete!
# ============================================================================
echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Obtain SSL certificate:"
echo "   sudo certbot --nginx -d admin-tailorbook.yiion.com"
echo ""
echo "2. Test your deployment:"
echo "   https://admin-tailorbook.yiion.com"
echo ""
echo "3. Check logs:"
echo "   pm2 logs tailor-book-api"
echo ""
echo "4. Manage deployment:"
echo "   cd $PROJECT_DIR"
echo "   pm2 status          # Check status"
echo "   pm2 restart all     # Restart services"
echo "   pm2 logs           # View logs"
echo ""
echo "=========================================="
