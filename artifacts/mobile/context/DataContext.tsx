import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Customer,
  CustomMeasurementField,
  FamilyMember,
  Invoice,
  InvoiceItem,
  ItemDeliveryStatus,
  Measurement,
  MeasurementUnit,
  Notification,
  Order,
  OrderItem,
  OrderStatus,
  ProductType,
} from "@/types";
import { useAuth } from "./AuthContext";
import {
  api,
  addCustomField as apiAddCustomField,
  createOrder as apiCreateOrder,
  deleteOrder as apiDeleteOrder,
  deleteCustomField as apiDeleteCustomField,
  getCustomFields as apiGetCustomFields,
  getToken,
  updateOrderStatus as apiUpdateOrderStatus,
} from "@/utils/api";
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
  addProductType: (data: { name: string; amount: number; unit?: MeasurementUnit; features?: ProductType["features"] }) => Promise<ProductType>;
  updateProductType: (id: string, data: { name?: string; amount?: number; unit?: MeasurementUnit; features?: ProductType["features"] }) => Promise<void>;
  deleteProductType: (id: string) => Promise<void>;
  addCustomField: (
    fieldName: string,
    scope?: {
      customerId?: string | null;
      familyMemberId?: string | null;
      productTypeId?: string | null;
      productType?: string | null;
    },
  ) => Promise<CustomMeasurementField>;
  deleteCustomField: (id: string) => Promise<void>;
  addMeasurement: (data: Omit<Measurement, "id" | "tailorId" | "createdAt">) => Promise<Measurement>;
  addMeasurementSession: (items: Omit<Measurement, "id" | "tailorId" | "createdAt">[]) => Promise<Measurement[]>;
  updateMeasurement: (id: string, data: Partial<Omit<Measurement, "id" | "tailorId" | "createdAt">>) => Promise<void>;
  /**
   * Delete a measurement. If it is referenced by orders or invoices the
   * delete is refused and the resolved object contains the referencing
   * record numbers so the UI can show them.
   */
  deleteMeasurement: (
    id: string,
  ) => Promise<void | { ok: false; references: { orders: string[]; invoices: string[] } }>;
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
  updateOrderStatus: (id: string, status?: Order["status"]) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  generateInvoiceFromOrder: (
    orderId: string,
    familyMemberId?: string | null,
    itemId?: string,
  ) => Promise<Invoice>;
  updateItemDeliveryStatus: (itemId: string, status: ItemDeliveryStatus) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAllNotifications: (options?: { muteTypes?: string[] }) => Promise<void>;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

/**
 * Calculate order status based on item delivery statuses.
 * - "pending": No items delivered
 * - "partially-delivered": Some items delivered, some pending
 * - "completed": All items delivered
 */
function calculateOrderStatus(items?: OrderItem[]): OrderStatus {
  if (!items || items.length === 0) return "pending";

  const deliveredCount = items.filter(it => it.deliveryStatus === "delivered").length;

  if (deliveredCount === 0) return "pending";
  if (deliveredCount === items.length) return "completed";
  return "partially-delivered";
}

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


  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * The API/DB returns decimal columns (price, totalAmount, advanceAmount,
   * balanceDue) as strings. Coerce them to numbers so UI arithmetic works.
   */
  function normalizeOrder(o: any): Order {
    return {
      ...o,
      totalAmount: Number(o.totalAmount ?? 0),
      advanceAmount: Number(o.advanceAmount ?? 0),
      balanceDue: Number(o.balanceDue ?? 0),
      items: (o.items ?? []).map((it: any) => ({
        ...it,
        price: Number(it.price ?? 0),
      })),
    };
  }

  function normalizeInvoice(inv: any): Invoice {
    return {
      ...inv,
      subtotal: Number(inv.subtotal ?? 0),
      total: Number(inv.total ?? 0),
      paidAmount: inv.paidAmount == null ? undefined : Number(inv.paidAmount),
      items: (inv.items ?? []).map((it: any) => ({
        ...it,
        price: Number(it.price ?? 0),
      })),
    };
  }

  function normalizeMeasurement(m: any): Measurement {
    const next = { ...m };
    for (const key of [
      "chest", "shoulder", "neck", "sleeve", "waist", "length",
      "hip", "thigh", "pantLength", "bottomWidth", "armhole", "wrist",
    ]) {
      if (next[key] !== undefined && next[key] !== null && next[key] !== "") {
        next[key] = Number(next[key]);
      }
    }
    next.date = next.date ?? next.measurementDate ?? next.createdAt;
    next.customMeasurements = next.customMeasurements ?? [];
    next.photos = next.photos ?? [];
    return next;
  }

  const refresh = useCallback(async () => {
    if (!user) {
      setCustomers([]); setFamilyMembers([]); setMeasurements([]);
      setInvoices([]); setOrders([]); setProductTypes([]); setCustomFields([]);
      setNotifications([]); setIsLoading(false);
      return;
    }
    setIsLoading(true);

    let token: string | null = null;
    try {
      token = await getToken();
    } catch {
      // Offline
    }

    let c = await getCustomers(user.id);
    let fm = await getFamilyMembers(user.id);
    let m = await getMeasurements(user.id);
    let inv = await getInvoices(user.id);
    let ord = await getOrders(user.id);
    let pt = await getProductTypes(user.id);
    let cf = await getCustomFields(user.id);

    if (token) {
      try {
        const [apiC, apiFm, apiM, apiInv, apiOrd, apiPt, apiCf] = await Promise.all([
          api.customers.get(token),
          api.familyMembers.get(token),
          api.measurements.get(token),
          api.invoices.get(token),
          api.orders.get(token),
          api.productTypes.get(token),
          api.customFields.get(token),
        ]);
        c = apiC;
        fm = apiFm;
        m = (apiM as any[]).map(normalizeMeasurement);
        inv = (apiInv as any[]).map(normalizeInvoice);
        ord = (apiOrd as any[]).map(normalizeOrder);
        // Only use API product types if the server returned some.
        // Otherwise keep the locally-seeded defaults (from first-login
        // or earlier seeds) — that way a new tailor always sees
        // default products even when the server has none yet.
        if ((apiPt as any[])?.length > 0) {
          pt = apiPt as any;
        }
        cf = apiCf;

        await Promise.all([
          saveAllCustomers(c),
          saveAllFamilyMembers(fm),
          saveAllMeasurements(m),
          saveAllInvoices(inv),
          saveAllOrders(ord),
          saveAllProductTypes(pt),
          saveAllCustomFields(cf),
        ]);
      } catch (err) {
        console.warn("Reconciling with API server failed (using offline AsyncStorage):", err);
      }
    }

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
    let c: Customer | null = null;
    try {
      const token = await getToken();
      if (token) {
        c = await api.customers.add(token, { ...data, tailorId: user.id });
      }
    } catch (err) {
      console.warn("addCustomer API failed, using local save:", err);
    }
    if (!c) {
      c = { id: generateId(), tailorId: user.id, createdAt: new Date().toISOString(), ...data };
    }
    await saveAllCustomers([...all, c]);
    setCustomers((prev) => [c!, ...prev]);
    return c;
  }

  async function updateCustomer(id: string, data: Partial<Pick<Customer, "name" | "mobile" | "gender">>) {
    const all = await rawGet<Customer>(STORAGE_KEYS.CUSTOMERS);
    await saveAllCustomers(all.map((c) => (c.id === id ? { ...c, ...data } : c)));
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    try {
      const token = await getToken();
      if (token) {
        await api.customers.update(token, id, data);
      }
    } catch (err) {
      console.warn("updateCustomer API failed:", err);
    }
  }

  async function deleteCustomer(id: string) {
    // Cascade in AsyncStorage: when a customer goes, everything tied
    // to them goes too — family members, measurements, orders, and
    // invoices. The server enforces the same via FK ON DELETE CASCADE.
    const [allC, allFM, allM, allO, allI] = await Promise.all([
      rawGet<Customer>(STORAGE_KEYS.CUSTOMERS),
      rawGet<FamilyMember>(STORAGE_KEYS.FAMILY_MEMBERS),
      rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS),
      rawGet<Order>(STORAGE_KEYS.ORDERS),
      rawGet<Invoice>(STORAGE_KEYS.INVOICES),
    ]);
    await Promise.all([
      saveAllCustomers(allC.filter((c) => c.id !== id)),
      saveAllFamilyMembers(allFM.filter((f) => f.primaryCustomerId !== id)),
      saveAllMeasurements(allM.filter((m) => m.customerId !== id)),
      saveAllOrders(allO.filter((o) => o.customerId !== id)),
      saveAllInvoices(allI.filter((i) => i.customerId !== id)),
    ]);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setFamilyMembers((prev) => prev.filter((f) => f.primaryCustomerId !== id));
    setMeasurements((prev) => prev.filter((m) => m.customerId !== id));
    setOrders((prev) => prev.filter((o) => o.customerId !== id));
    setInvoices((prev) => prev.filter((i) => i.customerId !== id));
    try {
      const token = await getToken();
      if (token) {
        await api.customers.delete(token, id);
      }
    } catch (err) {
      console.warn("deleteCustomer API failed:", err);
    }
  }

  // ── Family Members ────────────────────────────────────────────────────────
  async function addFamilyMember(data: Omit<FamilyMember, "id" | "tailorId" | "createdAt">) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<FamilyMember>(STORAGE_KEYS.FAMILY_MEMBERS);
    let f: FamilyMember | null = null;
    try {
      const token = await getToken();
      if (token) {
        f = await api.familyMembers.add(token, { ...data, tailorId: user.id });
      }
    } catch (err) {
      console.warn("addFamilyMember API failed, using local save:", err);
    }
    if (!f) {
      f = { id: generateId(), tailorId: user.id, createdAt: new Date().toISOString(), ...data };
    }
    await saveAllFamilyMembers([...all, f]);
    setFamilyMembers((prev) => [...prev, f!]);
    return f;
  }

  async function deleteFamilyMember(id: string) {
    // Cascading delete: removing a family member also removes their
    // measurements and drops any order/invoice items assigned to them
    // (the customer-only items remain untouched).
    const [allFM, allM, allO, allI] = await Promise.all([
      rawGet<FamilyMember>(STORAGE_KEYS.FAMILY_MEMBERS),
      rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS),
      rawGet<Order>(STORAGE_KEYS.ORDERS),
      rawGet<Invoice>(STORAGE_KEYS.INVOICES),
    ]);
    await Promise.all([
      saveAllFamilyMembers(allFM.filter((f) => f.id !== id)),
      saveAllMeasurements(allM.filter((m) => m.familyMemberId !== id)),
    ]);
    // Orders / invoices: drop items belonging to this family member
    // (and clean up the now-empty parent if every item is gone).
    const ordersKept = allO.map((o) => ({
      ...o,
      items: (o.items ?? []).filter((it) => it.familyMemberId !== id),
    })).filter((o) => (o.items?.length ?? 0) > 0);
    await saveAllOrders(ordersKept);
    const invoicesKept = allI.map((inv) => ({
      ...inv,
      items: (inv.items ?? []).filter((it) => it.familyMemberId !== id),
    })).filter((inv) => (inv.items?.length ?? 0) > 0);
    await saveAllInvoices(invoicesKept);
    setFamilyMembers((prev) => prev.filter((f) => f.id !== id));
    setMeasurements((prev) => prev.filter((m) => m.familyMemberId !== id));
    setOrders((prev) => prev.map((o) => {
      const found = ordersKept.find((x) => x.id === o.id);
      return found ?? o;
    }));
    setInvoices((prev) => prev.map((inv) => {
      const found = invoicesKept.find((x) => x.id === inv.id);
      return found ?? inv;
    }));
    try {
      const token = await getToken();
      if (token) {
        await api.familyMembers.delete(token, id);
      }
    } catch (err) {
      console.warn("deleteFamilyMember API failed:", err);
    }
  }

  // ── Product Types ─────────────────────────────────────────────────────────
  async function addProductType(data: { name: string; amount: number; unit?: MeasurementUnit; features?: ProductType["features"] }) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<ProductType>(STORAGE_KEYS.PRODUCT_TYPES);
    let pt: ProductType | null = null;
    try {
      const token = await getToken();
      if (token) {
        pt = await api.productTypes.add(token, data);
      }
    } catch (err) {
      console.warn("addProductType API failed, using local save:", err);
    }
    if (!pt) {
      const now = new Date().toISOString();
      pt = { id: generateId(), tailorId: user.id, createdAt: now, updatedAt: now, ...data };
    }
    await saveAllProductTypes([...all, pt]);
    setProductTypes((prev) => [...prev, pt!]);
    return pt;
  }

  async function updateProductType(id: string, data: { name?: string; amount?: number; unit?: MeasurementUnit; features?: ProductType["features"] }) {
    const all = await rawGet<ProductType>(STORAGE_KEYS.PRODUCT_TYPES);
    const updated = all.map((p) => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p));
    await saveAllProductTypes(updated);
    setProductTypes((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));

    if (data.features !== undefined) {
      const newLabels = data.features.map((f) => f.label);
      const previous = all.find((p) => p.id === id);
      const previousLabels = previous?.features?.map((f) => f.label) ?? [];
      const newLabelSet = new Set(newLabels);
      const previousLabelSet = new Set(previousLabels);

      const renamedLabelMap = new Map<string, string>();
      const removed = previous?.features?.filter((f) => !newLabelSet.has(f.label)) ?? [];
      const added = data.features.filter((f) => !previousLabelSet.has(f.label));
      removed.forEach((r, i) => {
        const candidate = added[i] ?? added.find((a) => a.gender === r.gender);
        if (candidate) renamedLabelMap.set(r.label, candidate.label);
      });

      const remapLabel = (label?: string | null) => {
        if (!label) return label;
        const parts = label.split(",").map((s) => s.trim()).filter(Boolean);
        const next: string[] = [];
        for (const p of parts) {
          if (newLabelSet.has(p)) {
            next.push(p);
          } else if (renamedLabelMap.has(p)) {
            next.push(renamedLabelMap.get(p)!);
          }
        }
        return next.join(", ");
      };

      const allMeasurements = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);
      const patchedMeasurements = allMeasurements.map((m) => {
        if (m.productTypeId !== id) return m;
        const newLabel = remapLabel(m.featureLabel);
        if (newLabel === m.featureLabel) return m;
        return { ...m, featureLabel: newLabel };
      });
      if (patchedMeasurements.some((m, i) => m !== allMeasurements[i])) {
        await saveAllMeasurements(patchedMeasurements);
        setMeasurements(patchedMeasurements);
      }

      const allOrders = await rawGet<Order>(STORAGE_KEYS.ORDERS);
      let ordersChanged = false;
      const patchedOrders = allOrders.map((o) => {
        let changed = false;
        const newItems = (o.items ?? []).map((it) => {
          if (it.productTypeId !== id) return it;
          const newLabel = remapLabel(it.featureLabel);
          if (newLabel === it.featureLabel) return it;
          changed = true;
          return { ...it, featureLabel: newLabel };
        });
        if (changed) {
          ordersChanged = true;
          return { ...o, items: newItems };
        }
        return o;
      });
      if (ordersChanged) {
        await saveAllOrders(patchedOrders);
        setOrders(patchedOrders);
      }

      const allInvoices = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
      let invoicesChanged = false;
      const patchedInvoices = allInvoices.map((inv) => {
        let changed = false;
        const newItems = (inv.items ?? []).map((it) => {
          if (it.productTypeId !== id) return it;
          const newLabel = remapLabel(it.featureLabel);
          if (newLabel === it.featureLabel) return it;
          changed = true;
          return { ...it, featureLabel: newLabel };
        });
        if (changed) {
          invoicesChanged = true;
          return { ...inv, items: newItems };
        }
        return inv;
      });
      if (invoicesChanged) {
        await saveAllInvoices(patchedInvoices);
        setInvoices(patchedInvoices);
      }
    }

    try {
      const token = await getToken();
      if (token) {
        await api.productTypes.update(token, id, data);
      }
    } catch (err) {
      console.warn("updateProductType API failed:", err);
    }
  }

  async function deleteProductType(id: string) {
    const all = await rawGet<ProductType>(STORAGE_KEYS.PRODUCT_TYPES);
    await saveAllProductTypes(all.filter((p) => p.id !== id));
    setProductTypes((prev) => prev.filter((p) => p.id !== id));
    try {
      const token = await getToken();
      if (token) {
        await api.productTypes.delete(token, id);
      }
    } catch (err) {
      console.warn("deleteProductType API failed:", err);
    }
  }

  // ── Custom Fields ─────────────────────────────────────────────────────────
  async function addCustomField(
    fieldName: string,
    scope?: {
      customerId?: string | null;
      familyMemberId?: string | null;
      productTypeId?: string | null;
      productType?: string | null;
    },
  ) {
    if (!user) throw new Error("Not authenticated");
    const token = await getToken();
    // Always persist to server first so the server-assigned UUID is used.
    // This ensures delete calls later can find the record by ID.
    let f: CustomMeasurementField;
    if (token) {
      f = await apiAddCustomField(token, fieldName, scope);
    } else {
      // Offline fallback — local-only ID (delete will soft-fail on next sync)
      f = {
        id: generateId(),
        tailorId: user.id,
        fieldName,
        customerId: scope?.customerId ?? null,
        familyMemberId: scope?.familyMemberId ?? null,
        productTypeId: scope?.productTypeId ?? null,
        productType: scope?.productType ?? null,
        createdAt: new Date().toISOString(),
      };
    }
    const all = await rawGet<CustomMeasurementField>(STORAGE_KEYS.CUSTOM_FIELDS);
    await saveAllCustomFields([...all, f]);
    setCustomFields((prev) => [...prev, f]);
    return f;
  }

  async function deleteCustomField(id: string) {
    const token = await getToken();
    if (token) {
      // Call server first; throws on failure so local state is not mutated
      await apiDeleteCustomField(token, id);
    }
    const all = await rawGet<CustomMeasurementField>(STORAGE_KEYS.CUSTOM_FIELDS);
    await saveAllCustomFields(all.filter((f) => f.id !== id));
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  }

  // ── Measurements ──────────────────────────────────────────────────────────
  async function addMeasurement(data: Omit<Measurement, "id" | "tailorId" | "createdAt">) {
    if (!user) throw new Error("Not authenticated");
    const all = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);
    let m: Measurement | null = null;
    try {
      const token = await getToken();
      if (token) {
        m = normalizeMeasurement(await api.measurements.add(token, { ...data, tailorId: user.id }));
      }
    } catch (err) {
      console.warn("addMeasurement API failed, using local save:", err);
    }
    if (!m) {
      m = {
        id: generateId(),
        tailorId: user.id,
        createdAt: new Date().toISOString(),
        ...data,
        customMeasurements: data.customMeasurements ?? [],
        photos: data.photos ?? [],
      };
    }
    await saveAllMeasurements([...all, m]);
    setMeasurements((prev) => [m!, ...prev]);
    return m;
  }

  async function addMeasurementSession(items: Omit<Measurement, "id" | "tailorId" | "createdAt">[]) {
    if (!user) throw new Error("Not authenticated");
    if (items.length === 0) throw new Error("At least one product is required");
    const all = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);

    let created: Measurement[] | null = null;
    try {
      const token = await getToken();
      if (token) {
        const payload = {
          customerId: items[0].customerId,
          familyMemberId: items[0].familyMemberId ?? null,
          measurementDate: items[0].measurementDate,
          deliveryDate: items[0].deliveryDate ?? undefined,
          notes: items[0].notes ?? undefined,
          photos: items[0].photos ?? [],
          items: items.map((it) => ({
            productTypeId: it.productTypeId ?? undefined,
            productType: it.productType,
            featureLabel: it.featureLabel ?? undefined,
            values: {
              chest: it.chest,
              shoulder: it.shoulder,
              neck: it.neck,
              sleeve: it.sleeve,
              waist: it.waist,
              length: it.length,
              hip: it.hip,
              thigh: it.thigh,
              pantLength: it.pantLength,
              bottomWidth: it.bottomWidth,
              armhole: it.armhole,
              wrist: it.wrist,
            },
            customMeasurements: it.customMeasurements ?? [],
            notes: it.notes ?? undefined,
            photos: it.photos ?? [],
          })),
        };
        const apiRes = await api.measurements.addSession(token, payload);
        if (apiRes && Array.isArray(apiRes.measurements)) {
          created = apiRes.measurements.map(normalizeMeasurement);
        } else if (apiRes && apiRes.id) {
          created = [normalizeMeasurement(apiRes)];
        }
      }
    } catch (err) {
      console.warn("addMeasurementSession API failed, using local save:", err);
    }

    if (!created) {
      const now = new Date().toISOString();
      const measurementSessionId = generateId();
      created = items.map((data) => ({
        id: generateId(),
        tailorId: user.id,
        createdAt: now,
        measurementSessionId,
        ...data,
        customMeasurements: data.customMeasurements ?? [],
        photos: data.photos ?? [],
      }));
    }

    await saveAllMeasurements([...all, ...created]);
    setMeasurements((prev) => [...created!, ...prev]);
    return created;
  }

  async function updateMeasurement(
    id: string,
    data: Partial<Omit<Measurement, "id" | "tailorId" | "createdAt">>
  ) {
    const all = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);
    const target = all.find((m) => m.id === id);
    const updated = all.map((m) => (m.id === id ? { ...m, ...data } : m));
    await saveAllMeasurements(updated);
    setMeasurements((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));

    // Cascade edits to every order and invoice item that references this
    // measurement. We rebuild the denormalized `measurement_values` map
    // from the new measurement state so the snapshots stay in sync.
    if (!target) return;
    const refreshed = { ...target, ...data };
    const newValues = buildMeasurementValueMap(refreshed);

    // Orders: walk every order_item that has measurementId === id and
    // update its `measurement_values` JSON.
    const allOrders = await rawGet<Order>(STORAGE_KEYS.ORDERS);
    let ordersTouched = false;
    const nextOrders = allOrders.map((o) => {
      let changed = false;
      const items = (o.items ?? []).map((it) => {
        if (it.measurementId === id) {
          ordersTouched = true;
          changed = true;
          return { ...it, measurementValues: newValues };
        }
        return it;
      });
      return changed ? { ...o, items } : o;
    });
    if (ordersTouched) {
      await saveAllOrders(nextOrders);
      setOrders((prev) => prev.map((o) => {
        const found = nextOrders.find((x) => x.id === o.id);
        return found ?? o;
      }));
    }

    // Invoices: same cascade.
    const allInvoices = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
    let invoicesTouched = false;
    const nextInvoices = allInvoices.map((inv) => {
      let changed = false;
      const items = (inv.items ?? []).map((it) => {
        if (it.measurementId === id) {
          invoicesTouched = true;
          changed = true;
          return { ...it, measurementValues: newValues };
        }
        return it;
      });
      return changed ? { ...inv, items } : inv;
    });
    if (invoicesTouched) {
      await saveAllInvoices(nextInvoices);
      setInvoices((prev) => prev.map((inv) => {
        const found = nextInvoices.find((x) => x.id === inv.id);
        return found ?? inv;
      }));
    }

    try {
      const token = await getToken();
      if (token) {
        await api.measurements.update(token, id, data);
      }
    } catch (err) {
      console.warn("updateMeasurement API failed:", err);
    }
  }

  /**
   * Build the denormalized `measurementValues` map that we copy onto
   * `order_items.measurement_values` / `invoice_items.measurement_values`
   * at order/invoice creation. We keep the keys the order detail page
   * already understands (chest/shoulder/.../customMeasurements labels)
   * and the values are stringified with an inch suffix when the
   * underlying value is a number — matching what the orders page does
   * when it seeds a new item from a measurement.
   */
  function buildMeasurementValueMap(m: Measurement): Record<string, string> {
    const out: Record<string, string> = {};
    const numericKeys = [
      "chest", "shoulder", "neck", "sleeve", "waist", "length",
      "hip", "thigh", "pantLength", "bottomWidth", "armhole", "wrist",
    ];
    for (const key of numericKeys) {
      const raw = (m as any)[key];
      if (typeof raw === "number" && raw > 0) out[key] = `${raw}"`;
    }
    for (const cm of m.customMeasurements ?? []) {
      if (cm.value > 0) out[cm.label] = `${cm.value}"`;
    }
    return out;
  }

  async function deleteMeasurement(
    id: string,
  ): Promise<void | { ok: false; references: { orders: string[]; invoices: string[] } }> {
    // Block the delete when an order or invoice item still references
    // this measurement. The UI surfaces the referencing numbers so the
    // user can fix them first.
    const orders = await rawGet<Order>(STORAGE_KEYS.ORDERS);
    const invoices = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
    const orderRefs: string[] = [];
    const invoiceRefs: string[] = [];
    for (const o of orders) {
      if ((o.items ?? []).some((it) => it.measurementId === id)) orderRefs.push(o.orderNumber);
    }
    for (const inv of invoices) {
      if ((inv.items ?? []).some((it) => it.measurementId === id)) invoiceRefs.push(inv.invoiceNumber);
    }
    if (orderRefs.length > 0 || invoiceRefs.length > 0) {
      return { ok: false as const, references: { orders: orderRefs, invoices: invoiceRefs } };
    }
    const all = await rawGet<Measurement>(STORAGE_KEYS.MEASUREMENTS);
    await saveAllMeasurements(all.filter((m) => m.id !== id));
    setMeasurements((prev) => prev.filter((m) => m.id !== id));

    try {
      const token = await getToken();
      if (token) {
        await api.measurements.delete(token, id);
      }
    } catch (err) {
      console.warn("deleteMeasurement API failed:", err);
    }
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

    let inv: Invoice | null = null;
    try {
      const token = await getToken();
      if (token) {
        inv = normalizeInvoice(await api.invoices.create(token, {
          customerId: data.customerId,
          customerName: data.customerName,
          customerMobile: data.customerMobile,
          subtotal,
          total: subtotal,
          status: "pending",
          deliveryDate: data.deliveryDate ?? undefined,
          notes: data.notes ?? undefined,
          items: items.map((it) => ({
            productTypeId: it.productTypeId ?? undefined,
            productType: it.productType,
            featureLabel: it.featureLabel ?? undefined,
            quantity: it.quantity,
            price: it.price,
            measurementId: it.measurementId ?? undefined,
            familyMemberId: it.familyMemberId ?? undefined,
            personName: it.personName,
            relation: it.relation,
            measurementValues: it.measurementValues ?? undefined,
          })),
        } as any));
      }
    } catch (err) {
      console.warn("createInvoice API failed, using local save:", err);
    }

    if (!inv) {
      const [invoiceNumber, orderLabel] = await Promise.all([
        getNextInvoiceNumber(),
        getNextOrderLabel(),
      ]);
      inv = {
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
    }

    await saveAllInvoices([...all, inv]);
    setInvoices((prev) => [inv!, ...prev]);
    return inv;
  }

  async function updateInvoiceStatus(id: string, status: Invoice["status"]) {
    const all = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
    await saveAllInvoices(all.map((i) => (i.id === id ? { ...i, status } : i)));
    setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      const token = await getToken();
      if (token) {
        await api.invoices.updateStatus(token, id, status);
      }
    } catch (err) {
      console.warn("updateInvoiceStatus API failed:", err);
    }
  }

  async function deleteInvoice(id: string) {
    // Cascading cleanup: drop the `invoiceId` reference on any order
    // item that was bundled into this invoice (so the order still
    // exists and can be re-invoiced).
    const [allI, allO] = await Promise.all([
      rawGet<Invoice>(STORAGE_KEYS.INVOICES),
      rawGet<Order>(STORAGE_KEYS.ORDERS),
    ]);
    await saveAllInvoices(allI.filter((i) => i.id !== id));
    const nextOrders = allO.map((o) => {
      const items = (o.items ?? []).map((it) =>
        it.invoiceId === id ? { ...it, invoiceId: undefined } : it,
      );
      return items === o.items ? o : { ...o, items };
    });
    await saveAllOrders(nextOrders);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    setOrders((prev) => prev.map((o) => {
      const found = nextOrders.find((x) => x.id === o.id);
      return found ?? o;
    }));
    try {
      const token = await getToken();
      if (token) {
        await api.invoices.delete(token, id);
      }
    } catch (err) {
      console.warn("deleteInvoice API failed:", err);
    }
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
    const totalAmount = data.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const advancePaid = Math.min(data.advanceAmount ?? 0, totalAmount);
    const balanceDue = totalAmount - advancePaid;
    const customer = customers.find((c) => c.id === data.customerId);

    // Enrich items locally with display fields for the offline cache + UI
    const enrichedItems = data.items.map((item) => {
      const member = item.familyMemberId
        ? familyMembers.find((fm) => fm.id === item.familyMemberId)
        : undefined;
      return {
        productTypeId: item.productTypeId ?? null,
        productType: item.productType,
        featureLabel: item.featureLabel ?? null,
        quantity: item.quantity,
        price: item.price,
        measurementId: item.measurementId ?? null,
        familyMemberId: item.familyMemberId ?? null,
        personName: member?.name ?? item.personName ?? customer?.name ?? data.customerName,
        relation: member?.relation ?? item.relation ?? "self",
        measurementValues: item.measurementValues ?? null,
      };
    });

    // Try the API first — server is the source of truth and assigns the
    // canonical order number + ids. Falls back to local AsyncStorage when
    // the API is unreachable (offline / dev server not running).
    let ord: Order | null = null;
    try {
      const token = await getToken();
      if (token) {
        const apiOrder = await apiCreateOrder(token, {
          customerId: data.customerId,
          customerName: data.customerName,
          customerMobile: data.customerMobile,
          status: "pending",
          totalAmount,
          deliveryDate: data.deliveryDate ?? null,
          notes: data.notes ?? null,
          advanceAmount: advancePaid,
          items: enrichedItems as any,
        });
        ord = {
          id: apiOrder.id,
          orderNumber: apiOrder.orderNumber,
          tailorId: user.id,
          customerId: data.customerId,
          customerName: data.customerName,
          customerMobile: data.customerMobile,
          status: apiOrder.status ?? "pending",
          deliveryDate: data.deliveryDate ?? null,
          notes: data.notes ?? null,
          totalAmount: Number(apiOrder.totalAmount ?? totalAmount),
          advanceAmount: Number(apiOrder.advanceAmount ?? advancePaid),
          balanceDue: Number(apiOrder.balanceDue ?? balanceDue),
          createdAt: apiOrder.createdAt,
          updatedAt: apiOrder.updatedAt,
          items: (apiOrder.items ?? []).map((it: any) => ({
            id: it.id,
            orderId: apiOrder.id,
            productTypeId: it.productTypeId ?? null,
            productType: it.productType,
            featureLabel: it.featureLabel ?? null,
            quantity: it.quantity,
            price: Number(it.price),
            measurementId: it.measurementId ?? null,
            familyMemberId: it.familyMemberId ?? null,
            personName: it.personName ?? null,
            relation: it.relation ?? null,
            measurementValues: it.measurementValues ?? null,
            deliveryStatus: it.deliveryStatus ?? "pending",
            invoiceId: it.invoiceId ?? null,
            createdAt: it.createdAt,
          })),
        };
      }
    } catch (err) {
      // API call failed — fall through to local save
      console.warn("addOrder API failed, using local save:", err);
    }

    if (!ord) {
      const orderNumber = await getNextOrderLabel();
      const orderId = generateId();
      const items: OrderItem[] = enrichedItems.map((e) => ({
        id: generateId(),
        orderId,
        createdAt: new Date().toISOString(),
        productTypeId: e.productTypeId ?? undefined,
        productType: e.productType,
        featureLabel: e.featureLabel,
        quantity: e.quantity,
        price: e.price,
        measurementId: e.measurementId ?? undefined,
        familyMemberId: e.familyMemberId ?? undefined,
        personName: e.personName ?? null,
        relation: e.relation ?? null,
        measurementValues: e.measurementValues ?? undefined,
        deliveryStatus: "pending",
        invoiceId: null,
      }));
      ord = {
        id: orderId,
        orderNumber,
        tailorId: user.id,
        customerId: data.customerId,
        customerName: data.customerName,
        customerMobile: data.customerMobile,
        status: "pending",
        deliveryDate: data.deliveryDate ?? null,
        notes: data.notes ?? null,
        totalAmount,
        advanceAmount: advancePaid,
        balanceDue,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items,
      };
    }

    await saveAllOrders([...all, ord]);
    setOrders((prev) => [ord!, ...prev]);
    return ord;
  }

  async function updateOrderStatus(id: string, status?: Order["status"]) {
    const all = await rawGet<Order>(STORAGE_KEYS.ORDERS);
    const order = all.find((o) => o.id === id);
    if (!order) return;

    // If status is provided (explicit update), use it. Otherwise, auto-calculate
    // based on item delivery statuses.
    const finalStatus = status ?? calculateOrderStatus(order.items);

    const updated = all.map((o) =>
      o.id === id ? { ...o, status: finalStatus, updatedAt: new Date().toISOString() } : o
    );
    await saveAllOrders(updated);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: finalStatus, updatedAt: new Date().toISOString() } : o))
    );

    // Best-effort sync to the server. If the call fails (offline / dev
    // server not running) we still keep the local change — the next
    // `refresh()` from the server will reconcile state.
    try {
      const token = await getToken();
      if (token && status) { // Only sync explicit status updates, not auto-calculated ones
        await apiUpdateOrderStatus(token, id, status);
      }
    } catch (err) {
      console.warn("updateOrderStatus API sync failed:", err);
    }
  }

  /**
 * Update delivery status of a single item and auto-calculate order status
 */
async function updateItemDeliveryStatus(itemId: string, status: ItemDeliveryStatus) {
  const allOrders = await rawGet<Order>(STORAGE_KEYS.ORDERS);
  const all = [...allOrders];

  for (let i = 0; i < all.length; i++) {
    const order = all[i];
    if (!order.items) continue;

    const itemIndex = order.items.findIndex(it => it.id === itemId);
    if (itemIndex === -1) continue;

    // Update item's delivery status
    const updatedItem = { ...order.items[itemIndex], deliveryStatus: status };
    const updatedItems = [...order.items];
    updatedItems[itemIndex] = updatedItem;

    // Auto-calculate and update order status
    const newOrderStatus = calculateOrderStatus(updatedItems);

    all[i] = {
      ...order,
      items: updatedItems,
      status: newOrderStatus,
      updatedAt: new Date().toISOString()
    };
  }

  await saveAllOrders(all);
  setOrders(prev => prev.map(order => {
    const updatedOrder = all.find(o => o.id === order.id);
    return updatedOrder ? { ...updatedOrder } : order;
  }));
}

async function deleteOrder(id: string) {
    // Cascading cleanup: when an order is deleted, any invoice whose
    // `orderId` points at it should drop the reference. The invoice
    // itself stays so the payment record survives. We also drop the
    // `invoiceId` link on any of this order's items so the order
    // appears "uninvoiced" after deletion.
    const [allO, allI] = await Promise.all([
      rawGet<Order>(STORAGE_KEYS.ORDERS),
      rawGet<Invoice>(STORAGE_KEYS.INVOICES),
    ]);

    // Drop the order locally first so the UI can update even if the
    // server is unreachable. Errors are surfaced by the caller's catch.
    await saveAllOrders(allO.filter((o) => o.id !== id));
    const nextInvoices = allI.map((inv) => {
      if (inv.orderId !== id) return inv;
      return { ...inv, orderId: undefined };
    });
    await saveAllInvoices(nextInvoices);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setInvoices((prev) =>
      prev.map((inv) => {
        const found = nextInvoices.find((x) => x.id === inv.id);
        return found ?? inv;
      })
    );

    // Best-effort server sync. We log + swallow the error here so the
    // caller doesn't see a network blip as a hard delete failure; the
    // local cache is already consistent and a later `refresh()` will
    // catch up the server-side state.
    try {
      const token = await getToken();
      if (token) {
        await apiDeleteOrder(token, id);
      }
    } catch (err) {
      console.warn("deleteOrder API sync failed (local delete succeeded):", err);
    }
  }

  async function generateInvoiceFromOrder(
    orderId: string,
    familyMemberId?: string | null,
    itemId?: string,
  ) {
    if (!user) throw new Error("Not authenticated");

    let order = orders.find((o) => o.id === orderId);
    if (!order) {
      // Try to get from storage if not in state
      const allOrders = await rawGet<Order>(STORAGE_KEYS.ORDERS);
      order = allOrders.find((o) => o.id === orderId);
    }
    if (!order) throw new Error("Order not found");

    const allInvoices = await rawGet<Invoice>(STORAGE_KEYS.INVOICES);
    const allOrders = await rawGet<Order>(STORAGE_KEYS.ORDERS);

    let itemsToInvoice = order.items?.filter((it) => !it.invoiceId) ?? [];
    if (itemsToInvoice.length === 0) throw new Error("No uninvoiced items in this order");

    if (itemId) {
      itemsToInvoice = itemsToInvoice.filter((it) => it.id === itemId);
    } else if (familyMemberId) {
      if (familyMemberId === "self") {
        itemsToInvoice = itemsToInvoice.filter((it) => !it.familyMemberId || it.relation === "self");
      } else {
        itemsToInvoice = itemsToInvoice.filter((it) => it.familyMemberId === familyMemberId);
      }
    }

    if (itemsToInvoice.length === 0) {
      throw new Error("No uninvoiced items found for this filter");
    }

    const subtotal = itemsToInvoice.reduce((s, it) => s + it.price * it.quantity, 0);

    let inv: Invoice | null = null;
    try {
      const token = await getToken();
      if (token) {
        inv = normalizeInvoice(await api.orders.generateInvoice(token, orderId, familyMemberId ?? undefined, itemId));
      }
    } catch (err) {
      console.warn("generateInvoiceFromOrder API failed, using local save:", err);
    }

    if (!inv) {
      const invoiceNumber = await getNextInvoiceNumber();
      const invoiceId = generateId();

      const invoiceItemsList: InvoiceItem[] = itemsToInvoice.map((it) => ({
        productTypeId: it.productTypeId ?? undefined,
        productType: it.productType,
        quantity: it.quantity,
        price: it.price,
        measurementId: it.measurementId ?? undefined,
        familyMemberId: it.familyMemberId,
        personName: it.personName,
        relation: it.relation,
        measurementValues: it.measurementValues ?? undefined,
        featureLabel: it.featureLabel ?? undefined,
      }));

      inv = {
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
        paidAmount: familyMemberId ? undefined : (order.advanceAmount ?? 0),
        status: "pending",
        deliveryDate: order.deliveryDate ?? undefined,
        notes: order.notes ?? undefined,
        createdAt: new Date().toISOString(),
        items: invoiceItemsList,
      };
    }

    await saveAllInvoices([...allInvoices, inv]);
    setInvoices((prev) => [inv!, ...prev]);

    const updatedOrders = allOrders.map((o) => {
      if (o.id === orderId) {
        const updatedItems = o.items?.map((it) => {
          const matched = itemsToInvoice.some((toInv) => toInv.id === it.id);
          return matched ? { ...it, invoiceId: inv!.id } : it;
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
            return matched ? { ...it, invoiceId: inv!.id } : it;
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
      updateItemDeliveryStatus,
      markNotificationRead, markAllRead, clearAllNotifications,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
