#!/bin/bash

# Fix API deployment issues
echo "=== Tailor Book API Fix Script ==="

# 1. Update CORS configuration to live domains
echo "1. Updating CORS configuration..."
sed -i 's|CORS_ORIGINS=.*|CORS_ORIGINS=https://admin-tailorbook.yiion.com,https://api-tailorbook.yiion.com,http://localhost:4000|' /home/api-tailorbook/public_html/Tailor-Book/artifacts/api-server/.env

# 2. Update API server port to match live deployment
echo "2. Updating API server port..."
sed -i 's|PORT=4000|PORT=443|' /home/api-tailorbook/public_html/Tailor-Book/artifacts/api-server/.env

# 3. Create traefik configuration for API routing
echo "3. Creating traefik configuration..."
sudo mkdir -p /traefik/dynamic
sudo tee /traefik/dynamic/api-tailorbook.yml > /dev/null <<EOF
http:
  routers:
    api-tailorbook:
      rule: "Host(\`api-tailorbook.yiion.com\`)"
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

# 4. Check if API server is running
echo "4. Checking API server..."
if curl -s http://localhost:4000/api/healthz > /dev/null 2>&1; then
    echo "✓ API server is running on port 4000"
else
    echo "⚠ API server not starting properly..."
    # Kill any existing process
    sudo pkill -f "tsx src/index.ts" || true
    sleep 2
    # Start API server
    cd /home/api-tailorbook/public_html/Tailor-Book/artifacts/api-server
    export PATH="$HOME/npm-local/node_modules/.bin:$PATH"
    nohup pnpm run dev > /tmp/api-server.log 2>&1 &
    echo "✓ Started API server"
    sleep 3
fi

# 5. Test the API
echo "5. Testing API..."
if curl -s https://api-tailorbook.yiion.com/api/healthz > /dev/null 2>&1; then
    echo "✓ Live API is responding"
else
    echo "⚠ Live API not responding yet - wait 30 seconds for traefik to reload"
    # Wait for traefik to reload config
    sleep 30
    if curl -s https://api-tailorbook.yiion.com/api/healthz > /dev/null 2>&1; then
        echo "✓ Live API is now responding"
    else
        echo "✗ Live API still not responding - check traefik logs"
        exit 1
    fi
fi

# 6. Test authentication flow
echo "6. Testing authentication..."
LOGIN_RESPONSE=$(curl -s -X POST https://api-tailorbook.yiion.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrMobile":"kaushik@gmail.com","password":"tailor123"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "✓ Login successful - got token"

    # Test API with token
    curl -s -H "Authorization: Bearer $TOKEN" https://api-tailorbook.yiion.com/api/auth/me > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✓ Authenticated API request successful"
    else
        echo "⚠ Authenticated API request failed - check token"
    fi
else
    echo "✗ Login failed - check API server logs"
    echo "Response: $LOGIN_RESPONSE"
fi

echo ""
echo "=== Fix Complete ==="
echo "API Server: https://api-tailorbook.yiion.com"
echo "Admin Panel: https://admin-tailorbook.yiion.com"
echo ""
echo "API Endpoints:"
echo "- POST /api/auth/login"
echo "- GET /api/customers"
echo "- GET /api/invoices"
echo "- GET /api/orders"
echo "- GET /api/measurements"
echo ""
echo "To restart API server:"
echo "cd /home/api-tailorbook/public_html/Tailor-Book/artifacts/api-server && export PATH=\"$HOME/npm-local/node_modules/.bin:\$PATH\" && pnpm run dev"