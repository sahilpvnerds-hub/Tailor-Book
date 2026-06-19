import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Customer,
  CustomMeasurementField,
  FamilyMember,
  Invoice,
  InvoiceItem,
  Measurement,
  MeasurementUnit,
  Notification,
  ProductType,
  Order,
  OrderItem,
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
  getMutedNotifTypes,
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
  setMutedNotifTypes,
  getOrders,
  saveAllOrders,
  STORAGE_KEYS,
} from "@/utils/storage";

interface DataContextType {
  customers: Customer[];
  familyMembers: FamilyMember[];
  measurements: Measurement[];
  invoices: Invoice[];
  orders: Order[];
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
  addProductType: (data: { name: string; amount: number; unit?: MeasurementUnit }) => Promise<ProductType>;
  updateProductType: (id: string, data: { name?: string; amount?: number; unit?: MeasurementUnit }) => Promise<void>;
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
    orderId?: string | null;
  }) => Promise<Invoice>;
  updateInvoiceStatus: (id: string, status: Invoice["status"]) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getCustomerInvoices: (customerId: string) => Invoice[];
  addOrder: (data: {
    customerId: string;
    customerName: string;
    customerMobile: string;
    items: Omit<OrderItem, "id" | "orderId" | "createdAt">[];
    notes?: string;
    deliveryDate?: string;
    advanceAmount?: number;
  }) => Promise<Order>;
  updateOrderStatus: (id: string, status: Order["status"]) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  generateInvoiceFromOrder: (orderId: string, familyMemberId?: string | null) => Promise<Invoice>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAllNotifications: (options?: { muteTypes?: string[] }) => Promise<void>;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [customFields, setCustomFields] = useState<CustomMeasurementField[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCustomers([]); setFamilyMembers([]); setMeasurements([]);
      setInvoices([]); setOrders([]); setProductTypes([]); setCustomFields([]);
      setNotifications([]); setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [c, fm, m, inv, ord, pt, cf] = await Promise.all([
      getCustomers(user.id),
      getFamilyMembers(user.id),
      getMeasurements(user.id),
      getInvoices(user.id),
      getOrders(user.id),
      getProductTypes(user.id),
      getCustomFields(user.id),
    ]);
    setCustomers(c.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setFamilyMembers(fm);
    setMeasurements(m.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setInvoices(inv.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setOrders(ord.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setProductTypes(pt);
    setCustomFields(cf);
    // Generate & reload notifications, but skip any type the user has
    // muted so they aren't bothered by reminders they've opted out of.
    await generateNotifications(user.id, m, inv);
    const [notifs, mutedTypes] = await Promise.all([
      getNotifications(user.id),
      getMutedNotifTypes(user.id),
    ]);
    const mutedSet = new Set(mutedTypes);
    const visibleNotifs = notifs.filter((n: Notification) => !mutedSet.has(n.type));
    setNotifications(visibleNotifs);
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
  async function addProductType(data: { name: string; amount: number; unit?: MeasurementUnit }) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<ProductType>(STORAGE_KEYS.PRODUCT_TYPES);
    const now = new Date().toISOString();
    const pt: ProductType = { id: generateId(), tailorId: user.id, createdAt: now, updatedAt: now, ...data };
    await saveAllProductTypes([...all, pt]);
    setProductTypes((prev) => [...prev, pt]);
    return pt;
  }

  async function updateProductType(id: string, data: { name?: string; amount?: number; unit?: MeasurementUnit }) {
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

  // ── Orders ──────────────────────────────────────────────────────────────────
  async function addOrder(data: {
    customerId: string;
    customerName: string;
    customerMobile: string;
    items: Omit<OrderItem, "id" | "orderId" | "createdAt">[];
    notes?: string;
    deliveryDate?: string;
    advanceAmount?: number;
  }) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<Order>(STORAGE_KEYS.ORDERS);
    const orderNumber = await getNextOrderLabel();
    const totalAmount = data.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const advancePaid = Math.min(data.advanceAmount ?? 0, totalAmount);
    const balanceDue = totalAmount - advancePaid;
    const orderId = generateId();
    const customer = customers.find((c) => c.id === data.customerId);

    const items: OrderItem[] = data.items.map((item) => {
      const member = item.familyMemberId
        ? familyMembers.find((fm) => fm.id === item.familyMemberId)
        : undefined;
      return {
        id: generateId(),
        orderId,
        createdAt: new Date().toISOString(),
        ...item,
        personName: member?.name ?? item.personName ?? customer?.name ?? data.customerName,
        relation: member?.relation ?? item.relation ?? "self",
        invoiceId: null,
      } as OrderItem;
    });

    const ord: Order = {
      id: orderId,
      orderNumber,
      tailorId: user.id,
      status: "pending",
      totalAmount,
      advanceAmount: advancePaid,
      balanceDue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
      items,
    };

    await saveAllOrders([...all, ord]);
    setOrders((prev) => [ord, ...prev]);
    return ord;
  }

  async function updateOrderStatus(id: string, status: Order["status"]) {
    const all = await rawGet<Order>(STORAGE_KEYS.ORDERS);
    const updated = all.map((o) =>
      o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o
    );
    await saveAllOrders(updated);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o))
    );
  }

  async function deleteOrder(id: string) {
    const all = await rawGet<Order>(STORAGE_KEYS.ORDERS);
    await saveAllOrders(all.filter((o) => o.id !== id));
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  async function generateInvoiceFromOrder(orderId: string, familyMemberId?: string | null) {
    if (!user) throw new Error("Not authenticated");

    const order = orders.find((o) => o.id === orderId);
    if (!order) throw new Error("Order not found");

    const allInvoices = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
    const allOrders = await rawGet<Order>(STORAGE_KEYS.ORDERS);

    let itemsToInvoice = order.items?.filter((it) => !it.invoiceId) ?? [];
    if (itemsToInvoice.length === 0) throw new Error("No uninvoiced items in this order");

    if (familyMemberId) {
      if (familyMemberId === "self") {
        itemsToInvoice = itemsToInvoice.filter((it) => !it.familyMemberId || it.relation === "self");
      } else {
        itemsToInvoice = itemsToInvoice.filter((it) => it.familyMemberId === familyMemberId);
      }
    }

    if (itemsToInvoice.length === 0) {
      throw new Error("No uninvoiced items found for this family member");
    }

    const subtotal = itemsToInvoice.reduce((s, it) => s + it.price * it.quantity, 0);
    const invoiceNumber = await getNextInvoiceNumber();
    const invoiceId = generateId();

    const invoiceItemsList: InvoiceItem[] = itemsToInvoice.map((it) => ({
      productType: it.productType,
      quantity: it.quantity,
      price: it.price,
      measurementId: it.measurementId ?? undefined,
      familyMemberId: it.familyMemberId,
      personName: it.personName,
      relation: it.relation,
      measurementValues: it.measurementValues ?? undefined,
    }));

    const inv: Invoice = {
      id: invoiceId,
      invoiceNumber,
      orderLabel: order.orderNumber,
      orderId: order.id,
      tailorId: user.id,
      customerId: order.customerId,
      customerName: order.customerName,
      customerMobile: order.customerMobile,
      subtotal,
      total: subtotal,
      // Carry advance from order proportionally if billing a sub-set of members
      paidAmount: familyMemberId ? undefined : (order.advanceAmount ?? 0),
      status: "pending",
      deliveryDate: order.deliveryDate ?? undefined,
      notes: order.notes ?? undefined,
      createdAt: new Date().toISOString(),
      items: invoiceItemsList,
    };

    await saveAllInvoices([...allInvoices, inv]);
    setInvoices((prev) => [inv, ...prev]);

    const updatedOrders = allOrders.map((o) => {
      if (o.id === orderId) {
        const updatedItems = o.items?.map((it) => {
          const matched = itemsToInvoice.some((toInv) => toInv.id === it.id);
          return matched ? { ...it, invoiceId } : it;
        }) ?? [];
        return { ...o, items: updatedItems, updatedAt: new Date().toISOString() };
      }
      return o;
    });

    await saveAllOrders(updatedOrders);
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updatedItems = o.items?.map((it) => {
            const matched = itemsToInvoice.some((toInv) => toInv.id === it.id);
            return matched ? { ...it, invoiceId } : it;
          }) ?? [];
          return { ...o, items: updatedItems, updatedAt: new Date().toISOString() };
        }
        return o;
      })
    );

    return inv;
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

  /**
   * Clear every notification for the current user. If `options.muteTypes`
   * is provided, those notification types are also added to the user's
   * muted list so they won't be re-generated on the next refresh.
   */
  async function clearAllNotifications(options?: { muteTypes?: string[] }) {
    if (!user) return;
    const all = await rawGet<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    await saveAllNotifications(all.filter((n) => n.tailorId !== user.id));
    if (options?.muteTypes && options.muteTypes.length > 0) {
      const existing = await getMutedNotifTypes(user.id);
      const merged = Array.from(new Set([...existing, ...options.muteTypes]));
      await setMutedNotifTypes(user.id, merged);
    }
    setNotifications([]);
  }

  return (
    <DataContext.Provider value={{
      customers, familyMembers, measurements, invoices, orders,
      productTypes, customFields, notifications, unreadCount,
      isLoading, refresh,
      addCustomer, updateCustomer, deleteCustomer,
      addFamilyMember, deleteFamilyMember,
      addProductType, updateProductType, deleteProductType,
      addCustomField, deleteCustomField,
      addMeasurement, addMeasurementSession, updateMeasurement, deleteMeasurement, getCustomerMeasurements,
      getCustomerMeasurementsByProduct, getCustomerProducts,
      createInvoice, updateInvoiceStatus, deleteInvoice, getCustomerInvoices,
      addOrder, updateOrderStatus, deleteOrder, generateInvoiceFromOrder,
      markNotificationRead, markAllRead, clearAllNotifications,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
