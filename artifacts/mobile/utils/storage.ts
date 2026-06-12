import AsyncStorage from "@react-native-async-storage/async-storage";
import { Customer, Invoice, Measurement, User } from "@/types";

export const STORAGE_KEYS = {
  USERS: "@tailorbook/users",
  CURRENT_USER: "@tailorbook/currentUser",
  CUSTOMERS: "@tailorbook/customers",
  MEASUREMENTS: "@tailorbook/measurements",
  INVOICES: "@tailorbook/invoices",
  INVOICE_COUNTER: "@tailorbook/invoiceCounter",
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

// Users
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

// Initialize default admin
export async function ensureAdminExists(): Promise<void> {
  const users = await getUsers();
  const adminExists = users.some((u) => u.role === "admin");
  if (!adminExists) {
    const admin: User = {
      id: generateId(),
      name: "Admin",
      email: "admin@tailorbook.com",
      mobile: "9999999999",
      password: "admin123",
      role: "admin",
      status: "approved",
      createdAt: new Date().toISOString(),
    };
    await saveUsers([admin]);
  }
}

// Customers
export async function getCustomers(): Promise<Customer[]> {
  return (await getStorageItem<Customer[]>(STORAGE_KEYS.CUSTOMERS)) ?? [];
}

export async function saveCustomers(customers: Customer[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.CUSTOMERS, customers);
}

// Measurements
export async function getMeasurements(): Promise<Measurement[]> {
  return (await getStorageItem<Measurement[]>(STORAGE_KEYS.MEASUREMENTS)) ?? [];
}

export async function saveMeasurements(measurements: Measurement[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.MEASUREMENTS, measurements);
}

// Invoices
export async function getInvoices(): Promise<Invoice[]> {
  return (await getStorageItem<Invoice[]>(STORAGE_KEYS.INVOICES)) ?? [];
}

export async function saveInvoices(invoices: Invoice[]): Promise<void> {
  await setStorageItem(STORAGE_KEYS.INVOICES, invoices);
}

export async function getNextInvoiceNumber(): Promise<string> {
  const counter = (await getStorageItem<number>(STORAGE_KEYS.INVOICE_COUNTER)) ?? 0;
  const next = counter + 1;
  await setStorageItem(STORAGE_KEYS.INVOICE_COUNTER, next);
  return `INV-${String(next).padStart(4, "0")}`;
}

// Utility
export function formatCurrency(amount: number): string {
  return `\u20B9${amount.toFixed(0)}`;
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
