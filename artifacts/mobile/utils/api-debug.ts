import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  User,
  Customer,
  Measurement,
  Invoice,
  ProductType,
  FamilyMember,
  CustomMeasurementField,
  Notification,
  PendingOtp,
  RegisterData,
  UpdateProfileData,
  Order,
  OrderItem,
} from "@/types";

// Debug version of API client with detailed error logging
export async function debugFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);

  console.log(`[API Debug ${requestId}] Request:`, {
    url,
    method: options.method,
    headers: options.headers,
    body: typeof options.body === 'string' ? options.body : '[binary]'
  });

  try {
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;

    const text = await response.text();
    let data: T;

    try {
      data = JSON.parse(text) as T;
    } catch (e) {
      console.log(`[API Debug ${requestId}] Response Text (JSON parse failed):`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        responseTime: `${responseTime}ms`,
        text: text.substring(0, 500)
      });
      throw new Error(`Failed to parse JSON response: ${e}`);
    }

    console.log(`[API Debug ${requestId}] Response:`, {
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`,
      headers: Object.fromEntries(response.headers.entries()),
      data: data
    });

    if (!response.ok) {
      console.error(`[API Debug ${requestId}] Error Response:`, data);
      throw new Error(`API Error (${response.status}): ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`[API Debug ${requestId}] Error:`, {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      url,
      method: options.method,
      responseTime: `${errorTime}ms`
    });
    throw error;
  }
}

export interface ApiError {
  ok: false;
  error: string;
  status: number;
}

// Re-export common domain types
export type {
  User,
  Customer,
  Invoice,
  Order,
  OrderItem,
  ProductType,
  FamilyMember,
  Measurement,
  Notification,
} from "@/types";

// Resolve the API base URL based on the runtime environment
function resolveApiBaseUrl(): string {
  console.log("[API Debug] Resolving API base URL...");

  // Web browser - use runtime auto-detection
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname, host, port } = window.location;
    console.log("[API Debug] Web environment detected:", {
      protocol,
      hostname,
      host,
      port,
      userAgent: navigator.userAgent
    });

    if (hostname) {
      if (hostname.endsWith("-tailorbook.yiion.com")) {
        console.log("[API Debug] Using production API URL: https://api-tailorbook.yiion.com/api");
        return "https://api-tailorbook.yiion.com/api";
      }
      if (!port || port === "80" || port === "443") {
        const url = `${protocol}//${host}/api`;
        console.log("[API Debug] Same-origin URL:", url);
        return url;
      }
      const url = `${protocol}//${hostname}:4000/api`;
      console.log("[API Debug] Local dev URL:", url);
      return url;
    }
  }

  // React Native or Node - use EXPO_PUBLIC_API_URL
  const override = typeof process !== "undefined" && (process as any).env?.EXPO_PUBLIC_API_URL;
  if (override) {
    const base = override.replace(/\/+$/, "");
    const url = base.endsWith("/api") ? base : `${base}/api`;
    console.log("[API Debug] Using override URL from environment:", {
      override,
      finalUrl: url
    });
    return url;
  }

  // Fallback
  console.log("[API Debug] Using fallback URL: http://localhost:4000/api");
  return "http://localhost:4000/api";
}

const API_BASE_URL = resolveApiBaseUrl();

export async function sendOtp(email: string): Promise<{ ok: boolean; message: string }> {
  const url = `${API_BASE_URL}/auth/send-otp`;
  console.log("[API Debug] Sending OTP to:", email);
  console.log("[API Debug] Request URL:", url);

  const response = await debugFetch<{ ok: boolean; message: string; error?: string }>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(response.error ?? "Failed to send OTP");
  }
  return response;
}

export async function verifyOtp(email: string, otp: string): Promise<{ ok: boolean; emailVerifiedAt: string }> {
  const url = `${API_BASE_URL}/auth/verify-otp`;
  console.log("[API Debug] Verifying OTP for:", email);

  const response = await debugFetch<{ ok: boolean; emailVerifiedAt: string; error?: string }>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });

  if (!response.ok) {
    throw new Error(response.error ?? "OTP verification failed");
  }
  return response;
}

export async function login(emailOrMobile: string, password: string): Promise<{ ok: true; token: string; user: User } | ApiError> {
  const url = `${API_BASE_URL}/auth/login`;
  console.log("[API Debug] Login attempt for:", emailOrMobile);

  try {
    const response = await debugFetch<any>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrMobile, password }),
    });

    if (response.error) {
      return {
        ok: false,
        error: response.error ?? "Login failed",
        status: 403,
      };
    }

    console.log("[API Debug] Login successful:", {
      hasToken: !!response.token,
      user: {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role
      }
    });

    return {
      ok: true,
      token: response.token,
      user: response.user,
    };
  } catch (error) {
    console.error("[API Debug] Login error:", error);
    throw error;
  }
}

export async function register(formData: RegisterData): Promise<{ ok: true; id: string; message: string }> {
  const url = `${API_BASE_URL}/auth/register`;
  console.log("[API Debug] Registration attempt");

  const response = await debugFetch<any>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (response.error) {
    throw new Error(response.error ?? "Registration failed");
  }
  return response;
}

// Add more API functions with debug logging as needed