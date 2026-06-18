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
} from "@/types";

// ── API Client Configuration ────────────────────────────────────────────────

// Resolve the API base URL based on the runtime environment.
// - On web (browser): use the same hostname the app is served from, but
//   point to port 4000. This makes the API reachable whether the dev server
//   runs on `localhost:8081`, a LAN IP, or a tunneled domain.
// - On iOS simulator: localhost works.
// - On Android emulator: use 10.0.2.2 (the host machine).
// - On a physical device: the user must override via EXPO_PUBLIC_API_URL
//   or by editing this constant.
function resolveApiBaseUrl(): string {
  const override =
    typeof process !== "undefined" &&
    (process as any).env?.EXPO_PUBLIC_API_URL;
  if (override) {
    // Strip trailing slash first, then ensure exactly one /api suffix.
    // This makes the env var forgiving: both
    //   http://192.168.0.89:4000      → http://192.168.0.89:4000/api
    //   http://192.168.0.89:4000/api  → http://192.168.0.89:4000/api
    // work correctly.
    const base = override.replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }

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

  return "http://localhost:4000/api";
}

const API_BASE_URL = resolveApiBaseUrl();

// Internal helper: parse a fetch response as JSON, or throw a friendly
// error. Handles the case where the dev server (Metro) returns HTML
// instead of the API response — e.g. when the user accidentally hits
// `/api/...` on port 8081 instead of 4000.
async function parseJson<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text();
  // If the response is HTML, the dev server intercepted the request.
  if (text.startsWith("<!") || text.startsWith("<html")) {
    throw new Error(
      `Got HTML instead of JSON. The API server may be down or the URL is wrong. ` +
        `Tried: ${res.url}. ` +
        `Make sure the API server is running on port 4000.`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`${fallbackError} (status ${res.status})`);
  }
}

interface ApiError {
  ok: false;
  error: string;
  status: number;
}

// ── Auth API ───────────────────────────────────────────────────────────────

export async function sendOtp(email: string): Promise<{ ok: boolean; devOtp?: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await parseJson<any>(response, "Failed to send OTP");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to send OTP");
  }
  return {
    ok: true,
    devOtp: data.devOtp,
    message: data.message,
  };
}

export async function verifyOtp(email: string, otp: string): Promise<{ ok: boolean; emailVerifiedAt: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  const data = await parseJson<any>(response, "OTP verification failed");
  if (!response.ok) {
    throw new Error(data.error ?? "OTP verification failed");
  }
  return {
    ok: true,
    emailVerifiedAt: data.emailVerifiedAt,
  };
}

export async function login(emailOrMobile: string, password: string): Promise<{ ok: true; token: string; user: User } | ApiError> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrMobile, password }),
  });
  const data = await parseJson<any>(response, "Login failed");
  if (!response.ok) {
    return {
      ok: false,
      error: data.error ?? "Login failed",
      status: response.status,
    };
  }
  return {
    ok: true,
    token: data.token,
    user: data.user,
  };
}

export async function register(formData: RegisterData): Promise<{ ok: true; id: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
  const data = await parseJson<any>(response, "Registration failed");
  if (!response.ok) {
    throw new Error(data.error ?? "Registration failed");
  }
  return {
    ok: true,
    id: data.id,
    message: data.message,
  };
}

export async function me(token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch user data");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch user data");
  }
  return data;
}

export async function logout(): Promise<{ ok: boolean }> {
  const token = await getToken();
  if (!token) return { ok: true };
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

export async function updateProfile(token: string, data: UpdateProfileData): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });
  const result = await parseJson<any>(response, "Failed to update profile");
  if (!response.ok) {
    throw new Error(result.error ?? "Failed to update profile");
  }
  return result;
}

// ── Admin API ─────────────────────────────────────────────────────────────

export async function getPendingUsers(token: string): Promise<User[]> {
  const response = await fetch(`${API_BASE_URL}/admin/pending-users`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch pending users");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch pending users");
  }
  return data;
}

export async function getAllTailors(token: string): Promise<User[]> {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch tailors");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch tailors");
  }
  return data;
}

export async function approveUser(token: string, userId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

export async function rejectUser(token: string, userId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

// ── Customers API ───────────────────────────────────────────────────────────

export async function getCustomers(token: string): Promise<Customer[]> {
  const response = await fetch(`${API_BASE_URL}/customers`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch customers");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch customers");
  }
  return data;
}

export async function addCustomer(token: string, customer: Omit<Customer, "id" | "createdAt">): Promise<Customer> {
  const response = await fetch(`${API_BASE_URL}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(customer),
  });
  const data = await parseJson<any>(response, "Failed to add customer");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to add customer");
  }
  return data;
}

export async function updateCustomer(token: string, customerId: string, data: Partial<Pick<Customer, "name" | "mobile" | "gender">>): Promise<Customer> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });
  const result = await parseJson<any>(response, "Failed to update customer");
  if (!response.ok) {
    throw new Error(result.error ?? "Failed to update customer");
  }
  return result;
}

export async function deleteCustomer(token: string, customerId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

// ── Measurements API ───────────────────────────────────────────────────────

export async function getMeasurements(token: string, customerId?: string): Promise<Measurement[]> {
  const url = customerId ? `${API_BASE_URL}/measurements?customerId=${customerId}` : `${API_BASE_URL}/measurements`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch measurements");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch measurements");
  }
  return data;
}

export async function addMeasurement(token: string, measurement: Omit<Measurement, "id" | "createdAt">): Promise<Measurement> {
  const response = await fetch(`${API_BASE_URL}/measurements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(measurement),
  });
  const data = await parseJson<any>(response, "Failed to add measurement");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to add measurement");
  }
  return data;
}

export async function addMeasurementSession(
  token: string,
  session: {
    customerId: string;
    familyMemberId?: string | null;
    measurementDate?: string;
    date?: string;
    deliveryDate?: string;
    notes?: string;
    photos?: string[];
    items: Array<{
      productTypeId?: string;
      productType: string;
      values: Record<string, string | number | null | undefined>;
      customMeasurements?: { label: string; value: number }[];
      notes?: string;
      photos?: string[];
    }>;
  }
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/measurements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(session),
  });
  const data = await parseJson<any>(response, "Failed to add measurement session");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to add measurement session");
  }
  return data;
}

export async function updateMeasurement(token: string, measurementId: string, data: Partial<Omit<Measurement, "id" | "createdAt">>): Promise<Measurement> {
  const response = await fetch(`${API_BASE_URL}/measurements/${measurementId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });
  const result = await parseJson<any>(response, "Failed to update measurement");
  if (!response.ok) {
    throw new Error(result.error ?? "Failed to update measurement");
  }
  return result;
}

export async function deleteMeasurement(token: string, measurementId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/measurements/${measurementId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

// ── Invoices API ───────────────────────────────────────────────────────────

export async function getInvoices(token: string, customerId?: string): Promise<Invoice[]> {
  const url = customerId ? `${API_BASE_URL}/invoices?customerId=${customerId}` : `${API_BASE_URL}/invoices`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch invoices");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch invoices");
  }
  return data;
}

export async function createInvoice(token: string, invoice: Omit<Invoice, "id" | "createdAt">): Promise<Invoice> {
  const response = await fetch(`${API_BASE_URL}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(invoice),
  });
  const data = await parseJson<any>(response, "Failed to create invoice");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to create invoice");
  }
  return data;
}

export async function updateInvoiceStatus(token: string, invoiceId: string, status: Invoice["status"]): Promise<Invoice> {
  const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status }),
  });
  const data = await parseJson<any>(response, "Failed to update invoice status");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to update invoice status");
  }
  return data;
}

export async function deleteInvoice(token: string, invoiceId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

// ── Family Members API ──────────────────────────────────────────────────────

export async function getFamilyMembers(token: string, primaryCustomerId?: string): Promise<FamilyMember[]> {
  const url = primaryCustomerId ? `${API_BASE_URL}/family-members?primaryCustomerId=${primaryCustomerId}` : `${API_BASE_URL}/family-members`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch family members");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch family members");
  }
  return data;
}

export async function addFamilyMember(token: string, member: Omit<FamilyMember, "id" | "createdAt">): Promise<FamilyMember> {
  const response = await fetch(`${API_BASE_URL}/family-members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(member),
  });
  const data = await parseJson<any>(response, "Failed to add family member");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to add family member");
  }
  return data;
}

export async function deleteFamilyMember(token: string, memberId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/family-members/${memberId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

// ── Product Types API ───────────────────────────────────────────────────────

export async function getProductTypes(token: string): Promise<ProductType[]> {
  const response = await fetch(`${API_BASE_URL}/product-types`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch product types");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch product types");
  }
  return data;
}

export async function addProductType(token: string, productType: { name: string; amount: number }): Promise<ProductType> {
  const response = await fetch(`${API_BASE_URL}/product-types`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(productType),
  });
  const data = await parseJson<any>(response, "Failed to add product type");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to add product type");
  }
  return data;
}

export async function updateProductType(token: string, productTypeId: string, data: { name?: string; amount?: number }): Promise<ProductType> {
  const response = await fetch(`${API_BASE_URL}/product-types/${productTypeId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });
  const result = await parseJson<any>(response, "Failed to update product type");
  if (!response.ok) {
    throw new Error(result.error ?? "Failed to update product type");
  }
  return result;
}

export async function deleteProductType(token: string, productTypeId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/product-types/${productTypeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

// ── Custom Measurement Fields API ───────────────────────────────────────────

export async function getCustomFields(token: string): Promise<CustomMeasurementField[]> {
  const response = await fetch(`${API_BASE_URL}/custom-fields`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch custom fields");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch custom fields");
  }
  return data;
}

export async function addCustomField(token: string, fieldName: string): Promise<CustomMeasurementField> {
  const response = await fetch(`${API_BASE_URL}/custom-fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ fieldName }),
  });
  const data = await parseJson<any>(response, "Failed to add custom field");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to add custom field");
  }
  return data;
}

export async function deleteCustomField(token: string, fieldId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/custom-fields/${fieldId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

// ── Notifications API ──────────────────────────────────────────────────────

export async function getNotifications(token: string): Promise<Notification[]> {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<any>(response, "Failed to fetch notifications");
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch notifications");
  }
  return data;
}

export async function markNotificationRead(token: string, notificationId: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

export async function markAllNotificationsRead(token: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

export async function clearAllNotifications(token: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE_URL}/notifications/clear-all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok };
}

// ── Token & User Storage ───────────────────────────────────────────────────

const TOKEN_KEY = "@tailorbook/token";
const USER_KEY = "@tailorbook/currentUser";

export async function getToken(): Promise<string | null> {
  return getStorageItem(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) {
    await setStorageItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function setCurrentUser(user: User | null): Promise<void> {
  if (user) {
    await setStorageItem(USER_KEY, user);
  } else {
    await AsyncStorage.removeItem(USER_KEY);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  return getStorageItem(USER_KEY);
}

// ── Utils ──────────────────────────────────────────────────────────────────

export async function getStorageItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function setOtpPending(pending: PendingOtp): Promise<void> {
  await setStorageItem("@tailorbook/pendingOtp", pending);
}

export async function getOtpPending(): Promise<PendingOtp | null> {
  return getStorageItem("@tailorbook/pendingOtp");
}

export async function clearOtpPending(): Promise<void> {
  await AsyncStorage.removeItem("@tailorbook/pendingOtp");
}

// ── API Setup ──────────────────────────────────────────────────────────────

export function setupApi() {
  // Called once at app startup.
}

export const api = {
  auth: {
    sendOtp,
    verifyOtp,
    login,
    register,
    me,
    logout,
    updateProfile,
    pendingUsers: getPendingUsers,
    allTailors: getAllTailors,
    approveUser,
    rejectUser,
  },
  customers: {
    get: getCustomers,
    add: addCustomer,
    update: updateCustomer,
    delete: deleteCustomer,
  },
  measurements: {
    get: getMeasurements,
    add: addMeasurement,
    addSession: addMeasurementSession,
    update: updateMeasurement,
    delete: deleteMeasurement,
  },
  invoices: {
    get: getInvoices,
    create: createInvoice,
    updateStatus: updateInvoiceStatus,
    delete: deleteInvoice,
  },
  familyMembers: {
    get: getFamilyMembers,
    add: addFamilyMember,
    delete: deleteFamilyMember,
  },
  productTypes: {
    get: getProductTypes,
    add: addProductType,
    update: updateProductType,
    delete: deleteProductType,
  },
  customFields: {
    get: getCustomFields,
    add: addCustomField,
    delete: deleteCustomField,
  },
  notifications: {
    get: getNotifications,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    clearAll: clearAllNotifications,
  },
};
