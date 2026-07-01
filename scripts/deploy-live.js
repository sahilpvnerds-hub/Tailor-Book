/**
 * Deploy script for live production environment
 *
 * This script:
 * 1. Clears all caches
 * 2. Builds the mobile app for production with the live API URL
 * 3. Starts the live static server
 *
 * Usage: node scripts/deploy-live.js
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const mobileRoot = path.resolve(__dirname, "..", "artifacts", "mobile");
const workspaceRoot = path.resolve(__dirname, "..");

function exitWithError(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function runCommand(cmd, args, cwd = mobileRoot) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Running: ${cmd} ${args.join(" ")}`);

    const process = spawn(cmd, args, { cwd, stdio: "inherit" });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on("error", (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log("🔥 Deploying to live production environment\n");

  try {
    // Step 1: Clear all caches
    console.log("🗑️  Clearing caches...");

    // Clear Metro cache
    const cacheDirs = [
      path.join(mobileRoot, ".metro-cache"),
      path.join(mobileRoot, "node_modules/.cache/metro"),
    ];

    for (const dir of cacheDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`   Cleared: ${dir}`);
      }
    }

    // Clear .expo directory
    const expoDir = path.join(mobileRoot, ".expo");
    if (fs.existsSync(expoDir)) {
      fs.rmSync(expoDir, { recursive: true, force: true });
      console.log(`   Cleared: ${expoDir}`);
    }

    console.log("✅ Cache cleared\n");

    // Step 2: Verify the live API is working
    console.log("🔍 Testing live API...");

    const apiTest = spawn("curl", [
      "-s",
      "https://api-tailorbook.yiion.com/healthz",
    ], { cwd: mobileRoot });

    let apiOutput = "";
    apiTest.stdout.on("data", (data) => {
      apiOutput += data.toString();
    });

    await new Promise((resolve) => {
      apiTest.on("close", (code) => {
        if (code === 0 && apiOutput.includes("ok")) {
          console.log("✅ Live API is healthy");
        } else {
          console.log("❌ Live API test failed");
          console.log("API Output:", apiOutput);
        }
        resolve();
      });
    });
    console.log("");

    // Step 3: Start Metro build
    console.log("🏗️  Building mobile app for production...");

    // Set the live API URL
    process.env.EXPO_PUBLIC_API_URL = "https://api-tailorbook.yiion.com";
    console.log(`🔧 Setting EXPO_PUBLIC_API_URL=${process.env.EXPO_PUBLIC_API_URL}`);

    await runCommand("node", ["scripts/build.js"], mobileRoot);

    console.log("✅ Production build completed\n");

    // Step 4: Start the static server
    console.log("🚀 Starting production server...");

    const serveProcess = spawn("node", ["server/serve.js"], {
      cwd: mobileRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: "3000",
        API_PROXY_TARGET: "https://api-tailorbook.yiion.com",
      },
    });

    console.log("\n🎉 Deployment complete!");
    console.log("\n📱 Live app URLs:");
    console.log("   Frontend: https://admin-tailorbook.yiion.com");
    console.log("   API:      https://api-tailorbook.yiion.com");
    console.log("   Server:   http://localhost:3000");

    // Keep the server running
    serveProcess.on("error", (err) => {
      console.error("❌ Server error:", err);
      process.exit(1);
    });

  } catch (error) {
    exitWithError(`Deployment failed: ${error.message}`);
  }
}

main();