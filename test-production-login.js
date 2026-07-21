const https = require('https');

const emailOrMobile = process.argv[2];
const password = process.argv[3];

if (!emailOrMobile || !password) {
  console.log("Usage: node test-production-login.js <emailOrMobile> <password>");
  process.exit(1);
}

const data = JSON.stringify({ emailOrMobile, password });

const options = {
  hostname: 'api-tailorbook.yiion.com',
  port: 443,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'User-Agent': 'okhttp/4.9.2'
  }
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log("=== DIAGNOSTIC RESULTS ===");
    console.log(`HTTP Status Code: ${res.statusCode}`);
    
    try {
      const json = JSON.parse(responseData);
      console.log("Response Body (JSON):", JSON.stringify(json, null, 2));
      
      if (res.statusCode === 403 && json.error?.includes('rejected')) {
        console.log("\n❌ DIAGNOSIS: Your account is officially marked as 'rejected' in the production MySQL database.");
        console.log("FIX: You must connect to your live database and run:");
        console.log(`UPDATE users SET status = 'approved' WHERE email = '${emailOrMobile}';`);
      } else if (res.statusCode === 401) {
        console.log("\n⚠️ DIAGNOSIS: The credentials are wrong or the account doesn't exist on the production database.");
      } else if (res.statusCode === 200) {
        console.log("\n✅ DIAGNOSIS: Login SUCCESSFUL on production! The account is approved.");
        console.log("If your APK still fails, you might have built the APK pointing to a different URL, or you typed the password wrong in the app.");
      } else {
        console.log("\n⚠️ DIAGNOSIS: Unexpected status code. The server returned something else.");
      }
    } catch (e) {
      console.log("Response Body (Raw HTML/Text):", responseData);
      console.log("\n❌ DIAGNOSIS: Cloudflare or a web server firewall is blocking the request. It returned HTML instead of JSON.");
    }
  });
});

req.on('error', (error) => {
  console.error("Network Error:", error);
});

req.write(data);
req.end();
