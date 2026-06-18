import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Customer,
  CustomMeasurementField,
  FamilyMember,
  Invoice,
  InvoiceItem,
  Measurement,
  Notification,
  ProductType,
} from "@/types";
import { useAuth } from "./AuthContext";
import {
  generateId,
  generateNotifications,
  getCustomers,
  getCustomFields,
  getFamilyMembers,
  getInvoices,
  getMeasurements,
  getNextInvoiceNumber,
  getNextOrderLabel,
  getNotifications,
  getProductTypes,
  getStorageItem,
  saveAllCustomers,
  saveAllCustomFields,
  saveAllFamilyMembers,
  saveAllInvoices,
  saveAllMeasurements,
  saveAllNotifications,
  saveAllProductTypes,
  STORAGE_KEYS,
} from "@/utils/storage";

interface DataContextType {
  customers: Customer[];
  familyMembers: FamilyMember[];
  measurements: Measurement[];
  invoices: Invoice[];
  productTypes: ProductType[];
  customFields: CustomMeasurementField[];
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addCustomer: (data: Omit<Customer, "id" | "tailorId" | "createdAt">) => Promise<Customer>;
  updateCustomer: (id: string, data: Partial<Pick<Customer, "name" | "mobile" | "gender">>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addFamilyMember: (data: Omit<FamilyMember, "id" | "tailorId" | "createdAt">) => Promise<FamilyMember>;
  deleteFamilyMember: (id: string) => Promise<void>;
  addProductType: (data: { name: string; amount: number }) => Promise<ProductType>;
  updateProductType: (id: string, data: { name?: string; amount?: number }) => Promise<void>;
  deleteProductType: (id: string) => Promise<void>;
  addCustomField: (fieldName: string) => Promise<CustomMeasurementField>;
  deleteCustomField: (id: string) => Promise<void>;
  addMeasurement: (data: Omit<Measurement, "id" | "tailorId" | "createdAt">) => Promise<Measurement>;
  addMeasurementSession: (items: Omit<Measurement, "id" | "tailorId" | "createdAt">[]) => Promise<Measurement[]>;
  updateMeasurement: (id: string, data: Partial<Omit<Measurement, "id" | "tailorId" | "createdAt">>) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  getCustomerMeasurements: (customerId: string) => Measurement[];
  getCustomerMeasurementsByProduct: (customerId: string, productType: string) => Measurement[];
  getCustomerProducts: (customerId: string) => { productType: string; count: number; latestDate: string }[];
  createInvoice: (data: {
    customerId: string;
    customerName: string;
    customerMobile: string;
    items: InvoiceItem[];
    notes?: string;
    deliveryDate?: string;
  }) => Promise<Invoice>;
  updateInvoiceStatus: (id: string, status: Invoice["status"]) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getCustomerInvoices: (customerId: string) => Invoice[];
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [customFields, setCustomFields] = useState<CustomMeasurementField[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCustomers([]); setFamilyMembers([]); setMeasurements([]);
      setInvoices([]); setProductTypes([]); setCustomFields([]);
      setNotifications([]); setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [c, fm, m, inv, pt, cf] = await Promise.all([
      getCustomers(user.id),
      getFamilyMembers(user.id),
      getMeasurements(user.id),
      getInvoices(user.id),
      getProductTypes(user.id),
      getCustomFields(user.id),
    ]);
    setCustomers(c.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setFamilyMembers(fm);
    setMeasurements(m.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setInvoices(inv.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setProductTypes(pt);
    setCustomFields(cf);
    // Generate & reload notifications
    await generateNotifications(user.id, m, inv);
    const notifs = await getNotifications(user.id);
    setNotifications(notifs);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Raw helpers to read/write the full global arrays
  async function rawGet<T>(key: string): Promise<T[]> {
    return (await getStorageItem<T[]>(key)) ?? [];
  }

  // ── Customers ────────────────────────────────────────────────────────────
  async function addCustomer(data: Omit<Customer, "id" | "tailorId" | "createdAt">) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<Customer>(STORAGE_KEYS.CUSTOMERS);
    const c: Customer = { id: generateId(), tailorId: user.id, createdAt: new Date().toISOString(), ...data };
    await saveAllCustomers([...all, c]);
    setCustomers((prev) => [c, ...prev]);
    return c;
  }

  async function updateCustomer(id: string, data: Partial<Pick<Customer, "name" | "mobile" | "gender">>) {
    const all = await rawGet<Customer>(STORAGE_KEYS.CUSTOMERS);
    await saveAllCustomers(all.map((c) => (c.id === id ? { ...c, ...data } : c)));
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  }

  async function deleteCustomer(id: string) {
    const [allC, allM, allI] = await Promise.all([
      rawGet<Customer>(STORAGE_KEYS.CUSTOMERS),
      rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS),
      rawGet<Invoice>(STORAGE_KEYS.INVOICES),
    ]);
    await Promise.all([
      saveAllCustomers(allC.filter((c) => c.id !== id)),
      saveAllMeasurements(allM.filter((m) => m.customerId !== id)),
      saveAllInvoices(allI.filter((i) => i.customerId !== id)),
    ]);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setMeasurements((prev) => prev.filter((m) => m.customerId !== id));
    setInvoices((prev) => prev.filter((i) => i.customerId !== id));
  }

  // ── Family Members ────────────────────────────────────────────────────────
  async function addFamilyMember(data: Omit<FamilyMember, "id" | "tailorId" | "createdAt">) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<FamilyMember>(STORAGE_KEYS.FAMILY_MEMBERS);
    const f: FamilyMember = { id: generateId(), tailorId: user.id, createdAt: new Date().toISOString(), ...data };
    await saveAllFamilyMembers([...all, f]);
    setFamilyMembers((prev) => [...prev, f]);
    return f;
  }

  async function deleteFamilyMember(id: string) {
    const all = await rawGet<FamilyMember>(STORAGE_KEYS.FAMILY_MEMBERS);
    await saveAllFamilyMembers(all.filter((f) => f.id !== id));
    setFamilyMembers((prev) => prev.filter((f) => f.id !== id));
  }

  // ── Product Types ─────────────────────────────────────────────────────────
  async function addProductType(data: { name: string; amount: number }) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<ProductType>(STORAGE_KEYS.PRODUCT_TYPES);
    const now = new Date().toISOString();
    const pt: ProductType = { id: generateId(), tailorId: user.id, createdAt: now, updatedAt: now, ...data };
    await saveAllProductTypes([...all, pt]);
    setProductTypes((prev) => [...prev, pt]);
    return pt;
  }

  async function updateProductType(id: string, data: { name?: string; amount?: number }) {
    const all = await rawGet<ProductType>(STORAGE_KEYS.PRODUCT_TYPES);
    await saveAllProductTypes(
      all.map((p) => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))
    );
    setProductTypes((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  }

  async function deleteProductType(id: string) {
    const all = await rawGet<ProductType>(STORAGE_KEYS.PRODUCT_TYPES);
    await saveAllProductTypes(all.filter((p) => p.id !== id));
    setProductTypes((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Custom Fields ─────────────────────────────────────────────────────────
  async function addCustomField(fieldName: string) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<CustomMeasurementField>(STORAGE_KEYS.CUSTOM_FIELDS);
    const f: CustomMeasurementField = { id: generateId(), tailorId: user.id, fieldName, createdAt: new Date().toISOString() };
    await saveAllCustomFields([...all, f]);
    setCustomFields((prev) => [...prev, f]);
    return f;
  }

  async function deleteCustomField(id: string) {
    const all = await rawGet<CustomMeasurementField>(STORAGE_KEYS.CUSTOM_FIELDS);
    await saveAllCustomFields(all.filter((f) => f.id !== id));
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  }

  // ── Measurements ──────────────────────────────────────────────────────────
  async function addMeasurement(data: Omit<Measurement, "id" | "tailorId" | "createdAt">) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);
    const m: Measurement = {
      id: generateId(), tailorId: user.id,
      createdAt: new Date().toISOString(),
      ...data,
      customMeasurements: data.customMeasurements ?? [],
      photos: data.photos ?? [],
    };
    await saveAllMeasurements([...all, m]);
    setMeasurements((prev) => [m, ...prev]);
    return m;
  }

  async function addMeasurementSession(items: Omit<Measurement, "id" | "tailorId" | "createdAt">[]) {
    if (!user) throw new Error("Not authenticated");
    if (items.length === 0) throw new Error("At least one product is required");
    const all = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);
    const now = new Date().toISOString();
    const measurementSessionId = generateId();
    const created: Measurement[] = items.map((data) => ({
      id: generateId(),
      tailorId: user.id,
      createdAt: now,
      measurementSessionId,
      ...data,
      customMeasurements: data.customMeasurements ?? [],
      photos: data.photos ?? [],
    }));
    await saveAllMeasurements([...all, ...created]);
    setMeasurements((prev) => [...created, ...prev]);
    return created;
  }

  async function updateMeasurement(
    id: string,
    data: Partial<Omit<Measurement, "id" | "tailorId" | "createdAt">>
  ) {
    const all = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);
    const updated = all.map((m) => (m.id === id ? { ...m, ...data } : m));
    await saveAllMeasurements(updated);
    setMeasurements((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  }

  async function deleteMeasurement(id: string) {
    const all = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);
    await saveAllMeasurements(all.filter((m) => m.id !== id));
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }

  function getCustomerMeasurements(customerId: string) {
    return measurements
      .filter((m) => m.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function getCustomerMeasurementsByProduct(customerId: string, productType: string) {
    return measurements
      .filter((m) => m.customerId === customerId && m.productType === productType)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function getCustomerProducts(customerId: string) {
    const byProduct = new Map<string, { productType: string; count: number; latestDate: string }>();
    for (const m of measurements) {
      if (m.customerId !== customerId) continue;
      const existing = byProduct.get(m.productType);
      const latest = existing?.latestDate ?? "";
      if (!existing) {
        byProduct.set(m.productType, {
          productType: m.productType,
          count: 1,
          latestDate: m.createdAt,
        });
      } else {
        existing.count += 1;
        if (m.createdAt > latest) existing.latestDate = m.createdAt;
      }
    }
    return Array.from(byProduct.values()).sort((a, b) =>
      b.latestDate.localeCompare(a.latestDate)
    );
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  async function createInvoice(data: {
    customerId: string;
    customerName: string;
    customerMobile: string;
    items: InvoiceItem[];
    notes?: string;
    deliveryDate?: string;
  }) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
    const [invoiceNumber, orderLabel] = await Promise.all([
      getNextInvoiceNumber(),
      getNextOrderLabel(),
    ]);
    const subtotal = data.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const customer = customers.find((c) => c.id === data.customerId);
    const items = data.items.map((item) => {
      const member = item.familyMemberId
        ? familyMembers.find((fm) => fm.id === item.familyMemberId)
        : undefined;
      return {
        ...item,
        personName: member?.name ?? item.personName ?? item.familyMemberName ?? customer?.name ?? data.customerName,
        relation: member?.relation ?? item.relation ?? "self",
        familyMemberName: member?.name ?? item.familyMemberName,
      };
    });
    const inv: Invoice = {
      id: generateId(),
      invoiceNumber,
      orderLabel,
      tailorId: user.id,
      subtotal,
      total: subtotal,
      status: "pending",
      createdAt: new Date().toISOString(),
      ...data,
      items,
    };
    await saveAllInvoices([...all, inv]);
    setInvoices((prev) => [inv, ...prev]);
    return inv;
  }

  async function updateInvoiceStatus(id: string, status: Invoice["status"]) {
    const all = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
    await saveAllInvoices(all.map((i) => (i.id === id ? { ...i, status } : i)));
    setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  async function deleteInvoice(id: string) {
    const all = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
    await saveAllInvoices(all.filter((i) => i.id !== id));
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }

  function getCustomerInvoices(customerId: string) {
    return invoices
      .filter((i) => i.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  async function markNotificationRead(id: string) {
    const all = await rawGet<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    await saveAllNotifications(all.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  async function markAllRead() {
    const all = await rawGet<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    await saveAllNotifications(all.map((n) => ({ ...n, isRead: true })));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function clearAllNotifications() {
    if (!user) return;
    const all = await rawGet<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    await saveAllNotifications(all.filter((n) => n.tailorId !== user.id));
    setNotifications([]);
  }

  return (
    <DataContext.Provider value={{
      customers, familyMembers, measurements, invoices,
      productTypes, customFields, notifications, unreadCount,
      isLoading, refresh,
      addCustomer, updateCustomer, deleteCustomer,
      addFamilyMember, deleteFamilyMember,
      addProductType, updateProductType, deleteProductType,
      addCustomField, deleteCustomField,
      addMeasurement, addMeasurementSession, updateMeasurement, deleteMeasurement, getCustomerMeasurements,
      getCustomerMeasurementsByProduct, getCustomerProducts,
      createInvoice, updateInvoiceStatus, deleteInvoice, getCustomerInvoices,
      markNotificationRead, markAllRead, clearAllNotifications,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
