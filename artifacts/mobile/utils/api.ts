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

const API_BASE_URL =
  ((typeof process !== "undefined" && (process as any)?.env?.EXPO_PUBLIC_API_URL) as
    | string
    | undefined) || "http://localhost:4000";

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
