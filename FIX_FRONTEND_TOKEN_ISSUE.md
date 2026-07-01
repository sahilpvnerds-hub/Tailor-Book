# Frontend Fix - 401 Authorization Issue

## Problem Analysis

**Symptom:** All APIs return 401 "Missing or invalid Authorization header"

**Root Causes:**
1. **AuthContext bug:** When `api.auth.me(token)` fails (expired token), it falls back to cached user BUT **keeps the invalid token** in localStorage → all subsequent API calls use bad token → 401
2. **Incorrect API URL:** On web build, the API URL resolution may point to the wrong domain
3. **Build-time vs Runtime API URL**: The frontend might not be using the live API URL

## Step 1: Fix AuthContext.tsx

**File:** `artifacts/mobile/context/AuthContext.tsx`

**Current problematic code (lines 50-70):**
```typescript
try {
  const fresh = await api.auth.me(token);
  await setCurrentUser(fresh);
  setUser(fresh);
  if (fresh.preferredLanguage && fresh.preferredLanguage !== i18n.language) {
    await i18n.changeLanguage(fresh.preferredLanguage);
  }
  setIsLoading(false);
  return;
} catch {
  // Token invalid or server down — fall back to cached user
}
setUser(cached);
```

**FIXED code:**
```typescript
try {
  const fresh = await api.auth.me(token);
  await setCurrentUser(fresh);
  setUser(fresh);
  if (fresh.preferredLanguage && fresh.preferredLanguage !== i18n.language) {
    await i18n.changeLanguage(fresh.preferredLanguage);
  }
  setIsLoading(false);
  return;
} catch {
  // Token invalid or server down — CLEAR invalid token and fall back to cached user
  await setToken(null); // ← THIS IS THE FIX
}
setUser(cached);
```

**Add check for cached user:**
```typescript
// Only use cached user if it exists
if (cached) {
  setUser(cached);
}
```

## Step 2: Fix api.ts - API URL Resolution

**File:** `artifacts/mobile/utils/api.ts`

**Current problematic code (lines 42-57):**
```typescript
if (typeof window !== "undefined" && window.location) {
  const { protocol, hostname, host, port } = window.location;
  // If the dev server is on a port other than 4000, the API is on
  // port 4000 of the same hostname. If the dev server IS on 4000
  // (production-like deployment), the API is at the same origin.
  if (hostname) {
    if (!port || port === "80" || port === "443") {
      return `${protocol}//${host}/api`;
    }
    // Default: assume API is on port 4000
    return `${protocol}//${hostname}:4000/api`;
  }
}
```

**FIXED code:**
```typescript
if (typeof window !== "undefined" && window.location) {
  const { protocol, hostname } = window.location;
  
  // Check for .env override first (for production builds)
  const override =
    (process as any).env?.EXPO_PUBLIC_API_URL;
  if (override) {
    // Strip trailing slash first, then ensure exactly one /api suffix
    const base = override.replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }
  
  // For live production: admin-tailorbook.yiion.com → api-tailorbook.yiion.com
  if (hostname === "admin-tailorbook.yiion.com") {
    return "https://api-tailorbook.yiion.com/api";
  }
  
  // Local dev: localhost
  if (hostname === "localhost") {
    return `${protocol}//${hostname}:4000/api`;
  }
}
```

## Step 3: Fix .env Configuration

**File:** `artifacts/mobile/.env`

**Current:**
```bash
EXPO_PUBLIC_API_URL=https://api-tailorbook.yiion.com/api
```

**FIXED (ensure no trailing slash):**
```bash
EXPO_PUBLIC_API_URL=https://api-tailorbook.yiion.com/api
```

## Step 4: Add Token Refresh Logic

**In AuthContext.tsx, add automatic login:**
```typescript
// If no user in state and no token, redirect to login
useEffect(() => {
  if (!user && !isLoading) {
    const checkAuth = async () => {
      const token = await getToken();
      if (!token) {
        // Should redirect to login
        window.location.href = '/login';
      }
    };
    checkAuth();
  }
}, [user, isLoading]);
```

## Step 5: Test the Fix

**Create test file: `test_auth_fix.js`:**
```javascript
// Login first
const loginResponse = await fetch('https://api-tailorbook.yiion.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    emailOrMobile: 'patelsahil2124@gmail.com',
    password: 'Sahil@#2124'
  })
});

const { token, user } = await loginResponse.json();
console.log('Login successful:', user.name);

// Test auth.me with token
const authMeResponse = await fetch('https://api-tailorbook.yiion.com/api/auth/me', {
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const authMeData = await authMeResponse.json();
console.log('Auth me:', authMeData.name);

// Test another API (customers)
const customersResponse = await fetch('https://api-tailorbook.yiion.com/api/customers', {
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const customersData = await customersResponse.json();
console.log('Customers count:', customersData.length);
```

## Step 6: Verify Frontend Builds

**For web build, ensure the API URL is correct:**
```bash
# Build the mobile web app
cd artifacts/mobile
node scripts/build.js
```

**Check the generated bundle:**
- In `dist/bundle.js`, search for `https://api-tailorbook.yiion.com/api`
- Verify the URL is correctly embedded

## Expected Behavior After Fix

1. **Login works:** → Returns valid token
2. **Auth.me works:** → Returns user data  
3. **All other APIs work:** → No more 401 errors
4. **Token refresh:** → When expired, user is logged out
5. **Cross-domain:** → Frontend at admin-tailorbook.yiion.com correctly calls api-tailorbook.yiion.com

## Testing Commands

```bash
# Test login and token generation
curl -X POST https://api-tailorbook.yiion.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrMobile":"patelsahil2124@gmail.com","password":"Sahil@#2124"}'

# Test all APIs with the token
TOKEN="your-token-here"
curl -H "Authorization: Bearer $TOKEN" https://api-tailorbook.yiion.com/api/customers
curl -H "Authorization: Bearer $TOKEN" https://api-tailorbook.yiion.com/api/orders
curl -H "Authorization: Bearer $TOKEN" https://api-tailorbook.yiion.com/api/invoices
```

This fix resolves the 401 "Missing or invalid Authorization header" error by clearing invalid tokens in AuthContext and ensuring correct API URL resolution.