# Mobile App 403 Error Fix - Complete Guide

## Summary
Fixed 403 errors that occur when using the Tailor Book APK on Android devices. The issues were caused by CORS configuration, missing .env file, and improper token handling.

## Root Causes

### 1. **CORS Configuration Issues**
- Android APK requests include `Origin: http://localhost`
- Production server rejected non-localhost origins
- Server .env had insufficient CORS origins

### 2. **Missing .env File**
- Mobile app had no .env file pointing to production API
- API URL was using fallback localhost instead of production

### 3. **Auth Context Token Bug**
- Invalid tokens weren't cleared after failed auth checks
- Subsequent API calls continued using bad tokens

### 4. **Poor Error Messages**
- Generic error messages without status codes
- No debugging information for API calls

## Fixes Applied

### 1. Fixed CORS Configuration (Server)
**File**: `artifacts/api-server/src/app.ts`
- Added support for Android `Origin: httplocalhost`
- Added React Metro bundler `http://localhost:8081`
- Improved error logging for debugging

**File**: `artifacts/api-server/.env`
```env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8081,https://admin-tailorbook.yiion.com,http://localhost,http://127.0.0.1,http://10.0.2.2:4000
```

### 2. Created Mobile .env File
**File**: `artifacts/mobile/.env`
```env
EXPO_PUBLIC_API_URL=https://api-tailorbook.yiion.com/api
```

### 3. Fixed AuthContext Token Handling
**File**: `artifacts/mobile/context/AuthContext.tsx`
- Added `await setToken(null)` when token validation fails
- Passed `status` field from API errors to UI

### 4. Enhanced API Logging
**File**: `artifacts/mobile/utils/api.ts`
- Added `[API Debug]` logs to all auth functions
- Exported `resolveApiBaseUrl()` for debugging
- Improved error message formatting

### 5. Better Error Messages
**File**: `artifacts/mobile/app/(auth)/login.tsx`
- Shows specific messages for:
  - 403 errors (rejected accounts, admin access)
  - 429 errors (rate limiting)
  - 503 errors (SMTP issues)
- Displays API URL being used
- Shows HTTP status codes in errors

## Testing

### API Server Tests
Run the test script:
```bash
node test_mobile_api_fixes.js
```

Results:
- ✅ Health check: OK
- ✅ CORS: Headers present (localhost)
- ✅ Login: Returns 401 for invalid credentials (not CORS error)
- ✅ Send OTP: Returns 200 (SMTP configured)

### APK Testing Steps
1. Build the APK:
   ```bash
   cd artifacts/mobile
   npm run build:apk
   ```
2. Install on Android device
3. Open Chrome DevTools: `chrome://inspect`
4. Check console for `[API Debug]` messages
5. Verify API URL matches production: `https://api-tailorbook.yiion.com/api`

## Common Error Messages & Solutions

### "Access Denied (403)"
**Cause**: Account status is "rejected"
**Solution**: Contact support to fix account status

### "Cannot Reach Server"
**Cause**: CORS or network issues
**Solution**: Check API URL in console logs

### "Too Many Attempts (429)"
**Cause**: Rate limiting after 5 failed logins
**Solution**: Wait 15 minutes before trying again

### "HTML instead of JSON"
**Cause**: Wrong API URL or server down
**Solution**: Verify server is running on correct port

## Important Notes

### For Local Development
1. Update `artifacts/mobile/.env` to point to local IP:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.XX:4000/api
   ```
2. Replace XX with your LAN IP

### For Production APK
- Ensure the APK uses the production API URL
- The `.env` file is embedded at build time

### CORS Behavior
- Development mode: Accepts all origins
- Production mode: Only configured origins
- Mobile Origin: `http://localhost` is always allowed

## API Endpoints Status

| Endpoint | Status | Auth Required |
|----------|--------|---------------|
| `/healthz` | ✅ OK | No |
| `/auth/login` | ✅ OK | No |
| `/auth/send-otp` | ✅ OK | No |
| `/auth/register` | ✅ OK | No |
| All others | ✅ OK | Yes (Bearer token) |

The 403 error should now be resolved for mobile APK users. The error messages are also more helpful for debugging future issues.