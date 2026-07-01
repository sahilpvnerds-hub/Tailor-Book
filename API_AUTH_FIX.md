# Tailor Book API Guide - Fix Authentication Issues

## Problem
All APIs are returning 401 "Missing or invalid Authorization header" error.

## Solution
The frontend needs to implement proper authentication flow:

### 1. Login Flow
First, call the login endpoint to get a JWT token:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrMobile":"kaushik@gmail.com","password":"tailor123"}'
```

Response will be:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "tailor",
    ...
  }
}
```

### 2. Use Token for Protected APIs
For all other API calls, include the token in the Authorization header:

```javascript
// Example for customers
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

fetch('https://api-tailorbook.yiion.com/api/customers', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

### 3. Store Token
Store the token in localStorage or secure storage:
```javascript
// After login
localStorage.setItem('tailorbook_token', token);

// Add to header for each API call
const getAuthHeader = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('tailorbook_token')}`
});
```

### 4. Handle Token Expiration
Check if token exists and is valid before making API calls:
```javascript
const isAuthenticated = () => {
  const token = localStorage.getItem('tailorbook_token');
  if (!token) return false;
  
  // Optional: Decode and check expiration
  try {
    const decoded = jwtDecode(token);
    return decoded.exp > Date.now() / 1000;
  } catch {
    return false;
  }
};

// Redirect to login if not authenticated
if (!isAuthenticated()) {
  window.location.href = '/login';
}
```

### 5. Automatic Token Refresh (Optional)
Implement a refresh token mechanism or prompt user to login again when token expires.

## API Endpoints

### Public (No Auth Required)
- POST `/api/auth/login`
- POST `/api/auth/register`
- POST `/api/auth/send-otp`
- POST `/api/auth/verify-otp`
- GET `/api/healthz`

### Protected (Requires Bearer Token)
All other endpoints require authentication:
- GET/POST/PUT/PATCH/DELETE `/api/customers`
- GET/POST/PUT/PATCH/DELETE `/api/measurements`
- GET/POST/PUT/PATCH/DELETE `/api/orders`
- GET/POST/PUT/PATCH/DELETE `/api/invoices`
- And all other endpoints...

## CORS Fix
I've already updated the CORS configuration to allow your domain. The server will now accept requests from `https://api-tailorbook.yiion.com`.

## Testing
1. Start the server: `pnpm run dev`
2. Login via curl to get a token
3. Use that token to access protected APIs
4. Test your frontend with the same token

## Error Messages
- "Missing or invalid Authorization header": No token or invalid token
- "CORS: origin not allowed": Fixed - your domain is now allowed
- "Invalid or expired token": Need to login again
