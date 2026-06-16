import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Customer,
  CustomMeasurementField,
  FamilyMember,
  Invoice,
  Measurement,
  Notification,
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

export async function ensureAdminExists(): Promise<void> {
  const users = await getUsers();
  const adminExists = users.some((u) => u.role === "admin");
  if (!adminExists) {
    const admin: User = {
      id: generateId(),
      name: "Admin",
      email: "admin@tailorbook.com",
      mobile: "9999999999",
      password: "Admin@123",
      role: "admin",
      status: "approved",
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
    };
    await saveUsers([admin]);
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

export async function generateNotifications(
  tailorId: string,
  measurements: Measurement[],
  invoices: Invoice[]
): Promise<void> {
  const existing = await getNotifications(tailorId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const newNotifs: Notification[] = [];

  for (const m of measurements) {
    if (!m.deliveryDate) continue;
    const del = new Date(m.deliveryDate);
    del.setHours(0, 0, 0, 0);
    const key = `delivery_${m.id}`;
    const alreadyExists = existing.some((n) => n.relatedId === key);
    if (alreadyExists) continue;

    if (del.getTime() === today.getTime()) {
      newNotifs.push({
        id: generateId(),
        tailorId,
        title: "Delivery Due Today",
        message: `${m.customerName}'s ${m.productType} is due today`,
        isRead: false,
        type: "delivery_due_today",
        relatedId: key,
        createdAt: new Date().toISOString(),
      });
    } else if (del.getTime() === tomorrow.getTime()) {
      newNotifs.push({
        id: generateId(),
        tailorId,
        title: "Delivery Due Tomorrow",
        message: `${m.customerName}'s ${m.productType} is due tomorrow`,
        isRead: false,
        type: "delivery_due_tomorrow",
        relatedId: key,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  if (pendingInvoices.length > 0) {
    const key = `pending_inv_${today.toISOString().split("T")[0]}`;
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
