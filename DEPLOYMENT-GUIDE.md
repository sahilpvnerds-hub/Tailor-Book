# Tailor Book - Complete Deployment Guide

## Project Overview

Your project has two main components:
1. **API Server** (`artifacts/api-server`) — Express.js backend, runs on port 4000
2. **Mobile Web App** (`artifacts/mobile`) — Expo/React Native web build, runs on port 8081
3. **Database** (`lib/db`) — MySQL with Drizzle ORM

---

## Your Server Credentials

```
🌐 Website URL:  admin-tailorbook.yiion.com
🔐 Panel URL:     https://server1.yiion.com:10000/
👤 Username:      admin-tailorbook
🔑 Password:      Y!!0n1z3#
```

### Database Credentials

```
📦 Database:     admin_tailorbook
👤 DB User:      admin-tailorbook
🔑 DB Password:  Y!!0n1z3#
```

---

## Step 1 — Connect to Your Server

### Option A: SSH (Recommended for full deployment)

```bash
ssh admin-tailorbook@server1.yiion.com
# Password: Y!!0n1z3#
```

> If your local machine SSH key is not authorized on the server, you'll be prompted for the password above.

### Option B: Web Panel

1. Open **https://server1.yiion.com:10000/** in your browser
2. Login with the credentials above
3. Use the **Terminal** or **File Manager** built into the panel

---

## Step 2 — Install Required Software on Server

Run these commands on your server (Ubuntu/Debian assumed):

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version    # Should show v20.x.x
npm --version

# Install pnpm globally
npm install -g pnpm

# Install PM2 (process manager to keep app running)
npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install MySQL client (for running migrations)
sudo apt install -y mysql-client
```

---

## Step 3 — Create Project Directory

```bash
# Create directory on server
sudo mkdir -p /var/www/tailor-book
sudo chown -R $(whoami):$(whoami) /var/www/tailor-book
cd /var/www/tailor-book
```

---

## Step 4 — Upload Project Files

### Option A: Git (Recommended)

```bash
cd /var/www/tailor-book
# If you have a git repo, clone it:
git clone <your-repo-url> .
```

### Option B: SCP from Local Machine

On your **local machine**, run:

```bash
# Navigate to project directory
cd "d:/New folder/Tailor-Book"

# Upload via SCP (run on your local machine terminal)
scp -r . admin-tailorbook@server1.yiion.com:/var/www/tailor-book/
```

> You'll be prompted for password: `Y!!0n1z3#`

### Option C: ZIP and Upload

```bash
# On your LOCAL machine, create a zip (exclude node_modules and .git)
cd "d:/New folder/Tailor-Book"
zip -r tailor-book-deploy.zip . -x "node_modules/*" -x ".git/*" -x ".pnpm-store/*"

# Upload the zip
scp tailor-book-deploy.zip admin-tailorbook@server1.yiion.com:/var/www/tailor-book/

# On SERVER, extract
cd /var/www/tailor-book
unzip tailor-book-deploy.zip
```

---

## Step 5 — Configure Environment Variables

### Create API Server .env

```bash
cd /var/www/tailor-book
nano artifacts/api-server/.env
```

Paste this content:

```env
# Backend
PORT=4000
NODE_ENV=production
LOG_LEVEL=info

# MySQL Database
DATABASE_URL=mysql://admin-tailorbook:Y!!0n1z3#@localhost:3306/admin_tailorbook

# Or use individual variables:
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=admin-tailorbook
MYSQL_PASSWORD=Y!!0n1z3#
MYSQL_DATABASE=admin_tailorbook

# Authentication
JWT_SECRET=your-super-long-random-secret-key-change-this-in-production
JWT_EXPIRES_IN=30d
```

> **Important:** Change the `JWT_SECRET` to a long random string. Generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### Create Mobile App .env

```bash
nano artifacts/mobile/.env
```

Paste this content:

```env
# API URL - point to your domain
EXPO_PUBLIC_API_URL=https://admin-tailorbook.yiion.com
EXPO_PUBLIC_DOMAIN=admin-tailorbook.yiion.com
```

---

## Step 6 — Install Dependencies

```bash
cd /var/www/tailor-book

# Install all dependencies (this will take a few minutes)
pnpm install

# Build the workspace type definitions
pnpm run typecheck:libs
```

---

## Step 7 — Build the API Server

```bash
cd /var/www/tailor-book
pnpm --filter @workspace/api-server run build
```

---

## Step 8 — Build the Mobile Web App

```bash
cd /var/www/tailor-book
pnpm --filter @workspace/mobile run build
```

> This will create a `static-build` directory in `artifacts/mobile/`

---

## Step 9 — Run Database Migrations

```bash
cd /var/www/tailor-book
pnpm --filter @workspace/lib-db run migrate
```

> **Note:** If the database tables already exist from previous data, migrations may fail. Check if you need to seed the admin user.

### Seed Admin User (if needed)

```bash
cd /var/www/tailor-book/artifacts/api-server
pnpm exec tsx src/seed-admin.ts
```

---

## Step 10 — Create Production Startup Scripts

### Create a startup script

```bash
nano /var/www/tailor-book/start.sh
```

Paste:

```bash
#!/bin/bash

export NODE_ENV=production
export PORT=8081
export API_PORT=4000
export REPLIT_DEV_DOMAIN=admin-tailorbook.yiion.com
export EXPO_PUBLIC_DOMAIN=admin-tailorbook.yiion.com
export EXPO_PUBLIC_API_URL=https://admin-tailorbook.yiion.com

cd /var/www/tailor-book

# Run as non-root user if needed
sudo -u www-data node serve.js
```

Make it executable:

```bash
chmod +x /var/www/tailor-book/start.sh
```

### OR Use PM2 for Process Management (Recommended)

```bash
cd /var/www/tailor-book

# Create ecosystem file
nano ecosystem.config.js
```

Paste:

```js
module.exports = {
  apps: [
    {
      name: 'tailor-book-api',
      script: 'node',
      args: '--enable-source-maps ./artifacts/api-server/dist/index.mjs',
      cwd: '/var/www/tailor-book',
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        DATABASE_URL: 'mysql://admin-tailorbook:Y!!0n1z3#@localhost:3306/admin_tailorbook',
        JWT_SECRET: 'your-super-long-random-secret-key-change-this-in-production',
        JWT_EXPIRES_IN: '30d',
      },
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Setup PM2 to start on reboot
pm2 startup
```

---

## Step 11 — Configure Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/tailor-book
```

Paste:

```nginx
server {
    listen 80;
    server_name admin-tailorbook.yiion.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name admin-tailorbook.yiion.com;

    # SSL Configuration (if using certbot, it will auto-configure)
    ssl_certificate /etc/letsencrypt/live/admin-tailorbook.yiion.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin-tailorbook.yiion.com/privkey.pem;
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
```

Enable the site:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tailor-book /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Step 12 — Setup SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (automatic)
sudo certbot --nginx -d admin-tailorbook.yiion.com

# Follow the prompts - enter email, agree to terms, etc.

# Auto-renewal is enabled by default. Test it:
sudo certbot renew --dry-run
```

---

## Step 13 — Setup Firewall

```bash
# Enable firewall and allow necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## Step 14 — Verify Deployment

### Test API directly:

```bash
curl http://localhost:4000/healthz
# Should return: {"status":"ok"} or similar
```

### Test Web App:

```bash
curl https://admin-tailorbook.yiion.com
# Should return HTML
```

### Test API through Nginx:

```bash
curl https://admin-tailorbook.yiion.com/api/healthz
```

---

## Quick Deployment Checklist

- [ ] Server connected via SSH
- [ ] Node.js 20.x installed
- [ ] pnpm installed
- [ ] PM2 installed
- [ ] Project files uploaded
- [ ] `artifacts/api-server/.env` configured
- [ ] `artifacts/mobile/.env` configured
- [ ] `pnpm install` completed
- [ ] API Server built (`pnpm --filter @workspace/api-server run build`)
- [ ] Mobile Web built (`pnpm --filter @workspace/mobile run build`)
- [ ] Database migrations run
- [ ] Admin user seeded
- [ ] PM2 process started
- [ ] Nginx configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Deployment verified

---

## Common Commands Reference

```bash
# Navigate to project
cd /var/www/tailor-book

# Check PM2 status
pm2 status

# View logs
pm2 logs tailor-book-api

# Restart services
pm2 restart all

# Check API health
curl http://localhost:4000/healthz

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx

# Run migrations manually
cd /var/www/tailor-book && pnpm --filter @workspace/lib-db run migrate

# Update and redeploy
cd /var/www/tailor-book
git pull
pnpm install
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/mobile run build
pm2 restart all
```

---

## Troubleshooting

### API not starting?

```bash
# Check if port 4000 is in use
lsof -i :4000

# Check API logs
pm2 logs tailor-book-api
```

### Database connection failed?

```bash
# Test MySQL connection
mysql -h localhost -u admin-tailorbook -p admin_tailorbook

# Check MySQL is running
sudo systemctl status mysql
```

### Nginx 502 Bad Gateway?

```bash
# Check if API is running
pm2 status

# Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log
```

### Mobile app not loading?

```bash
# Check static build exists
ls -la /var/www/tailor-book/artifacts/mobile/static-build/

# Check Nginx is pointing to correct path
sudo nano /etc/nginx/sites-available/tailor-book
```

---

## Security Reminders

1. **Change JWT_SECRET** in production to a long random string
2. **Don't commit `.env` files** to git (they're already in `.gitignore`)
3. **Use HTTPS** in production (Certbot configured above)
4. **Keep Node.js updated** for security patches
5. **Regular backups** of database recommended
6. **PM2 auto-restart** will recover from crashes automatically
