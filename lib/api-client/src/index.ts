/**
 * Lightweight fetch wrapper for the Tailor Book API.
 *
 *   const api = createApiClient({ baseUrl: 'http://localhost:3000' });
 *   const customers = await api.get('/customers');
 *
 * It also auto-attaches a bearer token via `getToken` and exposes hooks
 * to configure the base URL at runtime (useful for Expo where the dev
 * server's IP can change).
 */

export type AuthTokenGetter = () => string | null | Promise<string | null>;

interface ApiClientOptions {
  baseUrl: string;
  getToken?: AuthTokenGetter;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function createApiClient(opts: ApiClientOptions) {
  let baseUrl = opts.baseUrl.replace(/\/+$/, "");
  let getToken: AuthTokenGetter = opts.getToken ?? (() => null);

  async function request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const token = await Promise.resolve(getToken());
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders ?? {}),
    };

    let res: Response;
    try {
      // eslint-disable-next-line no-console
      console.log(`[api-client] ${method} ${url}`);
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err: any) {
      // The fetch() call itself failed — most commonly:
      //   - Network unreachable (API server not running)
      //   - DNS resolution failed
      //   - SSL / CORS issue
      //   - Wrong base URL (e.g. localhost on a physical device)
      const friendly = `Network request failed — could not reach ${url}. ` +
        `Make sure the API server is running and the base URL is correct. (${err?.message ?? err})`;
      // eslint-disable-next-line no-console
      console.error(`[api-client] ${friendly}`);
      throw new ApiError(0, null, friendly);
    }

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const message =
        (parsed && typeof parsed === "object" && "error" in (parsed as any)
          ? String((parsed as any).error)
          : `HTTP ${res.status}`) || `HTTP ${res.status}`;
      throw new ApiError(res.status, parsed, message);
    }
    return parsed as T;
  }

  return {
    setBaseUrl(url: string) {
      baseUrl = url.replace(/\/+$/, "");
    },
    setTokenGetter(fn: AuthTokenGetter) {
      getToken = fn;
    },
    getBaseUrl() {
      return baseUrl;
    },
    get: <T = unknown>(path: string, headers?: Record<string, string>) =>
      request<T>("GET", path, undefined, headers),
    post: <T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>("POST", path, body, headers),
    patch: <T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>("PATCH", path, body, headers),
    put: <T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>("PUT", path, body, headers),
    delete: <T = unknown>(path: string, headers?: Record<string, string>) =>
      request<T>("DELETE", path, undefined, headers),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

// ----- Shared types matching the API ---------------------------------------
export interface ApiUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: "admin" | "tailor";
  shopName?: string | null;
  shopAddress?: string | null;
  city?: string | null;
  state?: string | null;
  avatarUri?: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface ApiCustomer {
  id: string;
  tailorId: string;
  name: string;
  mobile: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  profilePicture?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMeasurement {
  id: string;
  customerId: string;
  familyMemberId?: string | null;
  tailorId: string;
  customerName: string;
  productType: string;
  measurementDate: string; // YYYY-MM-DD
  chest?: string | null;
  shoulder?: string | null;
  neck?: string | null;
  sleeve?: string | null;
  waist?: string | null;
  length?: string | null;
  hip?: string | null;
  thigh?: string | null;
  pantLength?: string | null;
  bottomWidth?: string | null;
  armhole?: string | null;
  wrist?: string | null;
  customMeasurements?: { label: string; value: number }[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiInvoiceItem {
  id: string;
  invoiceId: string;
  productType: string;
  quantity: number;
  price: string;
  measurementId?: string | null;
  familyMemberId?: string | null;
  personName?: string | null;
  relation?: string | null;
  measurementValues?: Record<string, string> | null;
  position: number;
  createdAt: string;
}

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  orderLabel: string;
  tailorId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  subtotal: string;
  gstRate: string;
  gstAmount: string;
  total: string;
  status: "pending" | "completed" | "cancelled";
  notes?: string | null;
  items: ApiInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

// ----- Endpoint methods (typed) -------------------------------------------
export function bindApiMethods(client: ApiClient) {
  return {
    // Auth
    login: (emailOrMobile: string, password: string) =>
      client.post<{ token: string; user: ApiUser }>("/api/auth/login", {
        emailOrMobile,
        password,
      }),
    register: (data: {
      name: string;
      email: string;
      mobile: string;
      password: string;
      shopName?: string;
      shopAddress?: string;
      city?: string;
      state?: string;
    }) => client.post<{ id: string; message: string }>("/api/auth/register", data),
    me: () => client.get<ApiUser>("/api/auth/me"),
    updateMe: (data: {
      name?: string;
      email?: string;
      mobile?: string;
      shopName?: string | null;
      shopAddress?: string | null;
      city?: string | null;
      state?: string | null;
      avatarUri?: string | null;
    }) => client.patch<ApiUser>("/api/auth/me", data),
    logout: () => client.post<{ ok: true }>("/api/auth/logout"),

    // Customers
    listCustomers: () => client.get<ApiCustomer[]>("/api/customers"),
    getCustomer: (id: string) => client.get<ApiCustomer>(`/api/customers/${id}`),
    createCustomer: (data: Omit<ApiCustomer, "id" | "tailorId" | "createdAt" | "updatedAt">) =>
      client.post<ApiCustomer>("/api/customers", data),
    updateCustomer: (id: string, data: Partial<ApiCustomer>) =>
      client.patch<ApiCustomer>(`/api/customers/${id}`, data),
    deleteCustomer: (id: string) => client.delete<{ ok: true }>(`/api/customers/${id}`),

    // Measurements
    listMeasurements: (params?: { customerId?: string }) => {
      const qs = params?.customerId ? `?customerId=${encodeURIComponent(params.customerId)}` : "";
      return client.get<ApiMeasurement[]>(`/api/measurements${qs}`);
    },
    getLatestMeasurement: (customerId: string, productType: string) =>
      client.get<ApiMeasurement>(
        `/api/measurements/latest?customerId=${encodeURIComponent(customerId)}&productType=${encodeURIComponent(productType)}`,
      ),
    getMeasurement: (id: string) => client.get<ApiMeasurement>(`/api/measurements/${id}`),
    createMeasurement: (data: Partial<ApiMeasurement>) =>
      client.post<ApiMeasurement>("/api/measurements", data),
    updateMeasurement: (id: string, data: Partial<ApiMeasurement>) =>
      client.patch<ApiMeasurement>(`/api/measurements/${id}`, data),
    deleteMeasurement: (id: string) =>
      client.delete<{ ok: true }>(`/api/measurements/${id}`),

    // Invoices
    listInvoices: (params?: { customerId?: string }) => {
      const qs = params?.customerId ? `?customerId=${encodeURIComponent(params.customerId)}` : "";
      return client.get<ApiInvoice[]>(`/api/invoices${qs}`);
    },
    getInvoice: (id: string) => client.get<ApiInvoice>(`/api/invoices/${id}`),
    createInvoice: (data: {
      customerId: string;
      customerName: string;
      customerMobile: string;
      gstRate: number;
      notes?: string;
      items: Array<{
        productType: string;
        quantity: number;
        price: number;
        measurementId?: string | null;
        familyMemberId?: string | null;
        personName?: string | null;
        relation?: string | null;
        measurementValues?: Record<string, string> | null;
      }>;
    }) => client.post<ApiInvoice>("/api/invoices", data),
    updateInvoiceStatus: (id: string, status: "pending" | "completed" | "cancelled") =>
      client.patch<ApiInvoice>(`/api/invoices/${id}/status`, { status }),
    deleteInvoice: (id: string) => client.delete<{ ok: true }>(`/api/invoices/${id}`),

    // Admin
    listUsers: () => client.get<ApiUser[]>("/api/admin/users"),
    listPendingUsers: () => client.get<ApiUser[]>("/api/admin/pending-users"),
    approveUser: (id: string) =>
      client.post<{ ok: true }>(`/api/admin/users/${id}/approve`),
    rejectUser: (id: string) =>
      client.post<{ ok: true }>(`/api/admin/users/${id}/reject`),
    updateUser: (id: string, data: {
      name?: string;
      email?: string;
      mobile?: string;
      role?: "admin" | "tailor";
      shopName?: string | null;
      shopAddress?: string | null;
      city?: string | null;
      state?: string | null;
      avatarUri?: string | null;
    }) => client.patch<ApiUser>(`/api/admin/users/${id}`, data),
  };
}

export type ApiMethods = ReturnType<typeof bindApiMethods>;

// ----- Default instance ----------------------------------------------------
let _client: ApiClient | null = null;
let _methods: ApiMethods | null = null;

export function configureApi(opts: ApiClientOptions) {
  _client = createApiClient(opts);
  _methods = bindApiMethods(_client);
  return _methods;
}

export function api(): ApiMethods {
  if (!_methods) {
    throw new Error(
      "API client not configured. Call configureApi({ baseUrl, getToken }) at app startup."
    );
  }
  return _methods;
}

export function apiClient(): ApiClient {
  if (!_client) {
    throw new Error("API client not configured.");
  }
  return _client;
}

export { createApiClient };
