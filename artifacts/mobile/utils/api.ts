import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  configureApi,
  api as apiMethods,
  type ApiMethods,
  type ApiUser,
  type ApiCustomer,
  type ApiMeasurement,
  type ApiInvoice,
} from "@workspace/api-client";

// Resolve the API base URL once, in this order of precedence:
//   1. EXPO_PUBLIC_API_URL (set this in .env or at start time for LAN access)
//   2. Auto-detected LAN IP (best-effort, dev only)
//   3. http://localhost:4000 (works for the web preview / simulator on the same machine)
function detectLanBaseUrl(): string | null {
  // Skip in production — never guess a base URL there.
  if (typeof __DEV__ === "undefined" || __DEV__ === false) return null;

  const envUrl =
    typeof process !== "undefined"
      ? (process as any)?.env?.EXPO_PUBLIC_API_URL
      : undefined;
  if (envUrl && typeof envUrl === "string") return envUrl;

  // Best-effort: enumerate IPv4 interfaces and pick the first non-loopback one.
  // Requires Node ≥18 / React Native with 'os' available. If it fails we just
  // fall back to localhost.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require("os") as typeof import("os");
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const info of ifaces[name] ?? []) {
        if (info.family === "IPv4" && !info.internal) {
          return `http://${info.address}:4000`;
        }
      }
    }
  } catch {
    /* 'os' not available — fall through */
  }
  return null;
}

const _fallback = detectLanBaseUrl();
const API_BASE_URL = _fallback ?? "http://localhost:4000";

// Tokens are stored in AsyncStorage for persistence across app restarts
const TOKEN_KEY = "tailorbook_token";
export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => AsyncStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);

// Configure the API client with the base URL and an auth-token getter.
// This must run once at app startup (see app/_layout.tsx).
let _configured = false;
export function setupApi() {
  if (_configured) return;
  configureApi({
    baseUrl: API_BASE_URL,
    getToken: async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    },
  });
  _configured = true;
  // eslint-disable-next-line no-console
  console.log(`[mobile] API base URL: ${API_BASE_URL}`);
}

// Re-export the typed API methods for use throughout the app
export const api = (): ApiMethods => apiMethods();
export type { ApiMethods, ApiUser, ApiCustomer, ApiMeasurement, ApiInvoice };
