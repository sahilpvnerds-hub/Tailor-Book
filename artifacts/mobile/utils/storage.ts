import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Customer,
  CustomMeasurementField,
  FamilyMember,
  Invoice,
  Measurement,
  Notification,
  PendingOtp,
  ProductType,
  User,
} from "@/types";
import { DEFAULT_PRODUCT_TYPES } from "@/constants/products";

export const STORAGE_KEYS = {
  USERS: "@tailorbook/users",
  CURRENT_USER: "@tailorbook/currentUser",
  CUSTOMERS: "@tailorbook/customers",
  FAMILY_MEMBERS: "@tailorbook/familyMembers",
  MEASUREMENTS: "@tailorbook/measurements",
  INVOICES: "@tailorbook/invoices",
  INVOICE_COUNTER: "@tailorbook/invoiceCounter",
  ORDER_COUNTER: "@tailorbook/orderCounter",
  PRODUCT_TYPES: "@tailorbook/productTypes",
  CUSTOM_FIELDS: "@tailorbook/customFields",
  NOTIFICATIONS: "@tailorbook/notifications",
  PENDING_OTP: "@tailorbook/pendingOtp",
};

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

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

// ── Users ──────────────────────────────────────────────────────────────────
export async function getUsers(): Promise<User[]> {
  return (await getStorageItem<User[]>(STORAGE_KEYS.USERS)) ?? [];
}

export async function saveUsers(users: User[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.USERS, users);
}

export async function getCurrentUser(): Promise<User | null> {
  return getStorageItem<User>(STORAGE_KEYS.CURRENT_USER);
}

export async function setCurrentUser(user: User | null): Promise<void> {
  if (user) {
    await setStorageItem(STORAGE_KEYS.CURRENT_USER, user);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

// ── Customers ──────────────────────────────────────────────────────────────
export async function getCustomers(tailorId: string): Promise<Customer[]> {
  const all = (await getStorageItem<Customer[]>(STORAGE_KEYS.CUSTOMERS)) ?? [];
  return all.filter((c) => c.tailorId === tailorId);
}

export async function saveAllCustomers(customers: Customer[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.CUSTOMERS, customers);
}

// ── Family Members ─────────────────────────────────────────────────────────
export async function getFamilyMembers(tailorId: string): Promise<FamilyMember[]> {
  const all = (await getStorageItem<FamilyMember[]>(STORAGE_KEYS.FAMILY_MEMBERS)) ?? [];
  return all.filter((f) => f.tailorId === tailorId);
}

export async function saveAllFamilyMembers(members: FamilyMember[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.FAMILY_MEMBERS, members);
}

// ── Product Types ──────────────────────────────────────────────────────────
export async function getProductTypes(tailorId: string): Promise<ProductType[]> {
  const all = (await getStorageItem<ProductType[]>(STORAGE_KEYS.PRODUCT_TYPES)) ?? [];
  const mine = all.filter((p) => p.tailorId === tailorId);
  if (mine.length === 0) {
    // Seed defaults on first use
    const now = new Date().toISOString();
    const defaults: ProductType[] = DEFAULT_PRODUCT_TYPES.map((p) => ({
      id: generateId(),
      tailorId,
      name: p.name,
      amount: p.amount,
      createdAt: now,
      updatedAt: now,
    }));
    await setStorageItem(STORAGE_KEYS.PRODUCT_TYPES, [...all, ...defaults]);
    return defaults;
  }
  return mine;
}

export async function saveAllProductTypes(types: ProductType[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.PRODUCT_TYPES, types);
}

// ── Measurements ───────────────────────────────────────────────────────────
export async function getMeasurements(tailorId: string): Promise<Measurement[]> {
  const all = (await getStorageItem<Measurement[]>(STORAGE_KEYS.MEASUREMENTS)) ?? [];
  return all.filter((m) => m.tailorId === tailorId);
}

export async function saveAllMeasurements(measurements: Measurement[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MEASUREMENTS, measurements);
}

// ── Invoices ───────────────────────────────────────────────────────────────
export async function getInvoices(tailorId: string): Promise<Invoice[]> {
  const all = (await getStorageItem<Invoice[]>(STORAGE_KEYS.INVOICES)) ?? [];
  return all.filter((i) => i.tailorId === tailorId);
}

export async function saveAllInvoices(invoices: Invoice[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.INVOICES, invoices);
}

export async function getNextInvoiceNumber(): Promise<string> {
  const counter = (await getStorageItem<number>(STORAGE_KEYS.INVOICE_COUNTER)) ?? 0;
  const next = counter + 1;
  await setStorageItem(STORAGE_KEYS.INVOICE_COUNTER, next);
  return `INV ${String(next).padStart(3, "0")}`;
}

export async function getNextOrderLabel(): Promise<string> {
  const counter = (await getStorageItem<number>(STORAGE_KEYS.ORDER_COUNTER)) ?? 0;
  const next = counter + 1;
  await setStorageItem(STORAGE_KEYS.ORDER_COUNTER, next);
  return `ORD ${String(next).padStart(3, "0")}`;
}

// ── Custom Measurement Fields ──────────────────────────────────────────────
export async function getCustomFields(tailorId: string): Promise<CustomMeasurementField[]> {
  const all = (await getStorageItem<CustomMeasurementField[]>(STORAGE_KEYS.CUSTOM_FIELDS)) ?? [];
  return all.filter((f) => f.tailorId === tailorId);
}

export async function saveAllCustomFields(fields: CustomMeasurementField[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.CUSTOM_FIELDS, fields);
}

// ── Notifications ──────────────────────────────────────────────────────────
export async function getNotifications(tailorId: string): Promise<Notification[]> {
  const all = (await getStorageItem<Notification[]>(STORAGE_KEYS.NOTIFICATIONS)) ?? [];
  return all.filter((n) => n.tailorId === tailorId).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  );
}

export async function saveAllNotifications(notifs: Notification[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.NOTIFICATIONS, notifs);
}

// ── Pending OTP (transient, per-registration) ──────────────────────────
export async function getPendingOtp(): Promise<PendingOtp | null> {
  return getStorageItem<PendingOtp>(STORAGE_KEYS.PENDING_OTP);
}

export async function setPendingOtp(p: PendingOtp | null): Promise<void> {
  if (p) {
    await setStorageItem(STORAGE_KEYS.PENDING_OTP, p);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_OTP);
  }
}

export async function generateNotifications(
  tailorId: string,
  measurements: Measurement[],
  invoices: Invoice[]
): Promise<void> {
  const existing = await getNotifications(tailorId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const todayKey = todayStart.toISOString().split("T")[0]; // "YYYY-MM-DD"

  const newNotifs: Notification[] = [];

  // ── Delivery alerts from invoices (have full order details) ──────────────
  for (const inv of invoices) {
    if (!inv.deliveryDate || inv.status === "cancelled" || inv.status === "completed") continue;

    const del = new Date(inv.deliveryDate);
    del.setHours(0, 0, 0, 0);
    const delMs = del.getTime();

    // Date-scoped key — new alert each day
    const dayKey = `inv_delivery_${inv.id}_${todayKey}`;
    if (existing.some((n) => n.relatedId === dayKey)) continue;

    // Collect unique item types
    const itemTypes = [...new Set(inv.items.map((it) => it.productType))];

    const base = {
      id: generateId(),
      tailorId,
      isRead: false,
      relatedId: dayKey,
      deliveryDate: inv.deliveryDate,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      customerMobile: inv.customerMobile,
      itemTypes,
      createdAt: new Date().toISOString(),
    };

    if (delMs < todayStart.getTime()) {
      newNotifs.push({
        ...base,
        title: "Delivery Overdue",
        message: `Order ${inv.invoiceNumber} for ${inv.customerName} is overdue`,
        type: "delivery_overdue",
      });
    } else if (delMs === todayStart.getTime()) {
      newNotifs.push({
        ...base,
        title: "Delivery Due Today",
        message: `Order ${inv.invoiceNumber} for ${inv.customerName} is due today`,
        type: "delivery_due_today",
      });
    } else if (delMs === tomorrowStart.getTime()) {
      newNotifs.push({
        ...base,
        title: "Delivery Due Tomorrow",
        message: `Order ${inv.invoiceNumber} for ${inv.customerName} is due tomorrow`,
        type: "delivery_due_tomorrow",
      });
    }
  }

  // ── Fallback: delivery alerts from measurements without an invoice ────────
  for (const m of measurements) {
    if (!m.deliveryDate) continue;
    // Skip if an invoice-based alert already covers this customer+date
    const del = new Date(m.deliveryDate);
    del.setHours(0, 0, 0, 0);
    const delMs = del.getTime();
    const dayKey = `meas_delivery_${m.id}_${todayKey}`;
    if (existing.some((n) => n.relatedId === dayKey)) continue;

    const base = {
      id: generateId(),
      tailorId,
      isRead: false,
      relatedId: dayKey,
      deliveryDate: m.deliveryDate,
      customerName: m.customerName,
      itemTypes: [m.productType],
      createdAt: new Date().toISOString(),
    };

    if (delMs < todayStart.getTime()) {
      newNotifs.push({ ...base, title: "Delivery Overdue", message: `${m.customerName}'s ${m.productType} delivery is overdue`, type: "delivery_overdue" });
    } else if (delMs === todayStart.getTime()) {
      newNotifs.push({ ...base, title: "Delivery Due Today", message: `${m.customerName}'s ${m.productType} is due today`, type: "delivery_due_today" });
    } else if (delMs === tomorrowStart.getTime()) {
      newNotifs.push({ ...base, title: "Delivery Due Tomorrow", message: `${m.customerName}'s ${m.productType} is due tomorrow`, type: "delivery_due_tomorrow" });
    }
  }

  // ── Pending invoice summary (one per day) ─────────────────────────────────
  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  if (pendingInvoices.length > 0) {
    const key = `pending_inv_${todayKey}`;
    if (!existing.some((n) => n.relatedId === key)) {
      newNotifs.push({
        id: generateId(),
        tailorId,
        title: "Pending Payments",
        message: `${pendingInvoices.length} invoice${pendingInvoices.length > 1 ? "s" : ""} pending collection`,
        isRead: false,
        type: "pending_invoice",
        relatedId: key,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (newNotifs.length > 0) {
    await saveAllNotifications([...existing, ...newNotifs]);
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return `\u20B9${amount.toFixed(0)}`;
}

// Backward-compat helper for invoices
export function displayOrderLabel(invoice: {
  invoiceNumber: string;
  orderLabel?: string;
}): string {
  return invoice.orderLabel || invoice.invoiceNumber;
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
