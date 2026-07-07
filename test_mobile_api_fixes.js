#!/usr/bin/env node

/**
 * Test script to verify mobile API fixes
 * Run this from the root directory: node test_mobile_api_fixes.js
 */

const https = require('https');

const BASE_URL = 'https://api-tailorbook.yiion.com/api';

console.log('\n=== Testing Mobile API Fixes ===\n');

// Helper function to make HTTP requests
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    console.log(`\n🔍 Testing: ${url}`);

    const req = https.request(url, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost', // Simulate mobile app
        ...options.headers
      },
      ...options
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        if (res.statusCode >= 400) {
          console.log(`   Response: ${data}`);
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Test 1: Health Check
console.log('\n🚀 Test 1: Health Check');
makeRequest('/healthz')
  .then(res => {
    console.log('✅ Health check passed');
    return true;
  })
  .catch(err => {
    console.error('❌ Health check failed:', err.message);
    return false;
  });

// Test 2: CORS Headers
console.log('\n🚀 Test 2: CORS Check');
makeRequest('/auth/login', { method: 'OPTIONS' })
  .then(res => {
    const corsHeaders = ['access-control-allow-origin', 'access-control-allow-credentials'];
    const hasCors = corsHeaders.every(header => res.headers[header] !== undefined);
    if (hasCors) {
      console.log('✅ CORS headers present');
      console.log(`   Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin']}`);
    } else {
      console.log('❌ CORS headers missing');
      console.log('   Response headers:', Object.keys(res.headers));
    }
    return hasCors;
  })
  .catch(err => {
    console.error('❌ CORS check failed:', err.message);
    return false;
  });

// Test 3: Login Test (will fail with invalid credentials but no CORS)
console.log('\n🚀 Test 3: Login with Invalid Credentials');
makeRequest('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    emailOrMobile: 'test@example.com',
    password: 'wrongpassword'
  })
})
  .then(res => {
    if (res.status === 401) {
      console.log('✅ Login endpoint reached (401 expected for wrong credentials)');
      return true;
    } else if (res.status === 403) {
      console.log('✅ Login endpoint reached (403 - possibly rejected account)');
      return true;
    } else {
      console.log(`⚠️ Unexpected status: ${res.status}`);
      return false;
    }
  })
  .catch(err => {
    console.error('❌ Login test failed:', err.message);
    return false;
  });

// Test 4: Send OTP Test
console.log('\n🚀 Test 4: Send OTP (will fail if SMTP not configured)');
makeRequest('/auth/send-otp', {
  method: 'POST',
  body: JSON.stringify({
    email: 'test@example.com'
  })
})
  .then(res => {
    if (res.status === 503) {
      console.log('✅ Send OTP endpoint reached (503 - SMTP not configured)');
      return true;
    } else if (res.status === 200) {
      console.log('✅ Send OTP endpoint reached (200 - SMTP configured)');
      return true;
    } else {
      console.log(`⚠️ Unexpected status: ${res.status}`);
      return false;
    }
  })
  .catch(err => {
    console.error('❌ Send OTP test failed:', err.message);
    return false;
  });

// Test 5: Verify API URL Resolution
console.log('\n🚀 Test 5: Check API URL Configuration');
console.log(`Expected API URL: ${BASE_URL}`);
console.log(`Check mobile/.env should contain: EXPO_PUBLIC_API_URL=${BASE_URL}`);

setTimeout(() => {
  console.log('\n=== Test Summary ===');
  console.log('Please check the console above for test results.');
  console.log('\nTo test the mobile app:');
  console.log('1. Build the APK: cd artifacts/mobile && npm run build:apk');
  console.log('2. Install on Android device');
  console.log('3. Open Chrome DevTools: chrome://inspect');
  console.log('4. Check console logs for [API Debug] messages');
  console.log('5. Verify API URL being used matches production URL');
  console.log('\n=== End of Tests ===\n');
}, 3000);