/**
 * Replit entry point.
 *
 * Runs BOTH the API server (port 4000) and the mobile web build (port 8081)
 * in the same Repl. The published link points at port 8081 (the mobile app),
 * and the mobile app talks to the API on the same Repl over its internal
 * hostname.
 *
 * On Replit, `$REPLIT_DEV_DOMAIN` looks like `tailor-book.username.repl.co`
 * — so the mobile app's API base URL is `https://<domain>` (and it appends
 * `/api/auth/login` etc). The internal hostname is reachable because both
 * processes share the same loopback.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = __dirname;
const MOBILE = path.join(ROOT, "artifacts", "mobile");
const API_SERVER = path.join(ROOT, "artifacts", "api-server");

const PORT_API = process.env.API_PORT || "4000";
const PORT_WEB = process.env.PORT || "8081";
const NODE_ENV = process.env.NODE_ENV || "production";

function spawnProcess(name, cwd, cmd, args, env) {
  console.log(`[runner] starting ${name}: ${cmd} ${args.join(" ")} (cwd=${cwd})`);
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env, FORCE_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    // shell:false so spaces in cwd / args don't get tokenised wrong on
    // Windows. We resolve the executable ourselves when shell is needed.
    shell: false,
  });
  child.stdout?.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`[${name}] ${d}`));
  child.on("exit", (code) => {
    console.error(`[runner] ${name} exited with code ${code}`);
    // If the API dies, the whole Repl should fail loudly so Replit restarts it.
    if (name === "api") {
      process.exit(code ?? 1);
    }
  });
  return child;
}

// ---------------------------------------------------------------------------
// 1) Start the API server (production bundle if available, else dev mode).
// ---------------------------------------------------------------------------
let apiCommand;
let apiArgs;
const apiDist = path.join(API_SERVER, "dist", "index.mjs");
if (fs.existsSync(apiDist)) {
  console.log("[runner] using built API server at dist/index.mjs");
  apiCommand = process.execPath; // node — no shell needed
  apiArgs = ["--enable-source-maps", apiDist];
} else {
  console.log("[runner] no built API dist found — falling back to tsx dev mode");
  // pnpm is a .cmd shim on Windows, so we go through the shell for it.
  apiCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  apiArgs = ["exec", "tsx", "src/index.ts"];
}
const api = spawnProcess("api", API_SERVER, apiCommand, apiArgs, {
  NODE_ENV,
  PORT: PORT_API,
});

// Wait for the API to become reachable before starting the mobile build,
// so the bundle can verify the backend is up.
async function waitForApi() {
  // Try a few well-known health endpoints — the API mounts health under
  // both / and /api/healthz depending on the build.
  const urls = [
    `http://127.0.0.1:${PORT_API}/api/healthz`,
    `http://127.0.0.1:${PORT_API}/healthz`,
    `http://127.0.0.1:${PORT_API}/`,
  ];
  for (let i = 0; i < 30; i++) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout });
        if (res.ok || res.status < 500) {
          console.log(`[runner] API ready (${res.status} at ${url})`);
          return;
        }
      } catch {
        /* not up yet */
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`[runner] API never became ready — continuing anyway`);
}

(async () => {
  await waitForApi();

  // -------------------------------------------------------------------------
  // 2) Build + serve the mobile web app.
  // -------------------------------------------------------------------------
  // The mobile package has a `serve.js` that already serves the static build
  // produced by `build.js`. We run the build first, then the server.
  // The build needs a deployment domain — we synthesize a default one if
  // we're not on Replit, so local `node serve.js` works for testing too.
  if (!process.env.REPLIT_DEV_DOMAIN && !process.env.EXPO_PUBLIC_DOMAIN) {
    process.env.REPLIT_DEV_DOMAIN = "localhost";
    process.env.EXPO_PUBLIC_DOMAIN = "localhost";
  }
  const buildScript = path.join(MOBILE, "scripts", "build.js");
  console.log("[runner] building mobile web bundle…");
  const build = spawnProcess("build", MOBILE, process.execPath, [buildScript], {
    NODE_ENV,
    REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
    EXPO_PUBLIC_DOMAIN: process.env.EXPO_PUBLIC_DOMAIN,
  });
  build.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[runner] mobile build failed with code ${code}`);
      process.exit(code ?? 1);
    }
    const serveScript = path.join(MOBILE, "server", "serve.js");
    console.log("[runner] starting mobile static server…");
    // On Replit, only the public port is reachable from the user's browser.
    // The mobile server proxies /api/* → http://127.0.0.1:4000 so the
    // bundled app can call the API at the same origin (avoids CORS, and
    // avoids "Network request failed" when the user opens the published
    // link from outside the Repl).
    const domain = process.env.REPLIT_DEV_DOMAIN || "localhost";
    spawnProcess("web", MOBILE, process.execPath, [serveScript], {
      NODE_ENV,
      PORT: PORT_WEB,
      API_PROXY_TARGET: process.env.API_PROXY_TARGET || `http://127.0.0.1:${PORT_API}`,
      EXPO_PUBLIC_API_URL:
        process.env.EXPO_PUBLIC_API_URL || `https://${domain}`,
    });
  });
})();

// Graceful shutdown
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    console.log(`[runner] received ${sig}, shutting down`);
    api.kill(sig);
    process.exit(0);
  });
}
