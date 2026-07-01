# Manual API Fix - No More 401/503 Errors

## Problem
Your APIs at `https://api-tailorbook.yiion.com` are returning:
- 503 Service Unavailable (server not running)
- 401 Unauthorized (authentication token issues)

## Solution

### Step 1: Fix API Server Environment

```bash
cd /home/api-tailorbook/public_html/Tailor-Book/artifacts/api-server

# Update .env file
sed -i 's|CORS_ORIGINS=.*|CORS_ORIGINS=https://admin-tailorbook.yiion.com,https://api-tailorbook.yiion.com,http://localhost:4000|' .env

# Save and open .env to verify
nano .env
```

### Step 2: Start API Server (if not running)

```bash
# Kill any existing process
sudo pkill -f "tsx src/index.ts" || true
sleep 2

# Start API server
export PATH="$HOME/npm-local/node_modules/.bin:$PATH"
nohup pnpm run dev > /tmp/api-server.log 2>&1 &

# Check if running
sleep 3
curl -s http://localhost:4000/api/healthz | jq .
```

### Step 3: Configure Traefik (Required for Live Server)

As root or with sudo:
```bash
# Find where to create config
for dir in /traefik/dynamic /etc/traefik/dynamic /root/traefik/dynamic; do
  if [ -d "$dir" ]; then
    echo "Creating config in: $dir"
    
    # Create API routing config
    cat > "$dir/api-tailorbook.yml" << 'EOF'
http:
  routers:
    api-tailorbook:
      rule: "Host(`api-tailorbook.yiion.com`)"
      entrypoints: ["https"]
      service: api-backend
      tls:
        certResolver: letsencrypt

  services:
    api-backend:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:4000"
EOF
    
    echo "✓ Config created"
    break
  fi
done
```

### Step 4: Reload Traefik

```bash
# Find traefik process and reload
sudo kill -HUP $(ps aux | grep "traefik" | grep -v grep | awk '{print $2}')

# Or restart traefik
sudo systemctl restart traefik
```

### Step 5: Test the API

```bash
# Test health endpoint
curl -s https://api-tailorbook.yiion.com/api/healthz | jq .

# Test login
curl -s -X POST https://api-tailorbook.yiion.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrMobile":"kaushik@gmail.com","password":"tailor123"}' | jq .

# Get token from login response and test protected endpoint
TOKEN="your_token_here_here"
curl -s -H "Authorization: Bearer $TOKEN" https://api-tailorbook.yiion.com/api/auth/me | jq .
```

## If Traefik Config Doesn't Work

If you cannot access `/traefik/dynamic/`, try Docker Compose approach:

```bash
# Create docker-compose.yml
cat > /home/api-tailorbook/public_html/Tailor-Book/docker-compose.yml << 'EOF'
version: '3.8'

services:
  api-server:
    build: ./artifacts/api-server
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - CORS_ORIGINS=https://admin-tailorbook.yiion.com,https://api-tailorbook.yiion.com

  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./traefik.yml:/etc/traefik/traefik.yml
      - /etc/letsencrypt:/etc/letsencrypt
    command:
      - --api.insecure=true
      - --providers.docker
      - --entrypoints.http.address=:80
      - --entrypoints.https.address=:443
      - --certificatesresolvers.letsencrypt.acme.tlschallenge=true
      - --certificatesresolvers.letsencrypt.acme.email=your-email@example.com
      - --certificatesresolvers.letsencrypt.acme.storage=/etc/letsencrypt/acme.json
EOF
```

## Quick Test Commands

```bash
# Test all endpoints
for endpoint in healthz customers invoices orders measurements; do
  echo "Testing /api/$endpoint:"
  curl -s https://api-tailorbook.yiion.com/api/$endpoint | jq . || echo "Failed"
  echo "---"
done

# Test with auth
echo "Testing auth flow:"
LOGIN=$(curl -s -X POST https://api-tailorbook.yiion.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrMobile":"kaushik@gmail.com","password":"tailor123"}')

echo "$LOGIN" | jq .
```

## Expected Output

After fixing:
```json
{
  "status": "ok"
}
```

No more:
```html
<h1>503 Service Unavailable</h1>
```

or:
```json
{
  "error": "Missing or invalid Authorization header"
}
```