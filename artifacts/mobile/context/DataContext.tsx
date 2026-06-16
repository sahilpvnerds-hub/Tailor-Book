import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/utils/api";
import { Customer, Invoice, InvoiceItem, Measurement, Product } from "@/types";
import { useAuth } from "./AuthContext";
import type { ApiCustomer, ApiMeasurement, ApiInvoice, ApiUser } from "@workspace/api-client";

interface DataContextType {
  customers: Customer[];
  measurements: Measurement[];
  invoices: Invoice[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addCustomer: (data: Omit<Customer, "id" | "tailorId" | "createdAt">) => Promise<Customer>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addMeasurement: (data: Omit<Measurement, "id" | "tailorId" | "createdAt">) => Promise<Measurement>;
  deleteMeasurement: (id: string) => Promise<void>;
  createInvoice: (data: {
    customerId: string;
    customerName: string;
    customerMobile: string;
    items: InvoiceItem[];
    gstRate: number;
    notes?: string;
  }) => Promise<Invoice>;
  updateInvoiceStatus: (id: string, status: Invoice["status"]) => Promise<void>;
  getCustomerMeasurements: (customerId: string) => Measurement[];
  getCustomerInvoices: (customerId: string) => Invoice[];
  getCustomerMeasurementForProduct: (customerId: string, productType: string) => Measurement | undefined;
  fetchLatestMeasurement: (customerId: string, productType: string) => Promise<Measurement | null>;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

// Convert API customer → local Customer shape
function apiToCustomer(c: ApiCustomer): Customer {
  return {
    id: c.id,
    tailorId: c.tailorId,
    name: c.name,
    mobile: c.mobile,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    notes: c.notes ?? undefined,
    createdAt: c.createdAt,
  };
}

// Convert API measurement → local Measurement shape
function apiToMeasurement(m: ApiMeasurement): Measurement {
  // The API stores decimals as strings; convert to numbers
  const toNum = (v: string | null | undefined) => {
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    id: m.id,
    customerId: m.customerId,
    tailorId: m.tailorId,
    customerName: m.customerName,
    date: m.measurementDate,
    productType: m.productType,
    chest: toNum(m.chest),
    shoulder: toNum(m.shoulder),
    neck: toNum(m.neck),
    sleeve: toNum(m.sleeve),
    waist: toNum(m.waist),
    length: toNum(m.length),
    hip: toNum(m.hip),
    thigh: toNum(m.thigh),
    pantLength: toNum(m.pantLength),
    bottomWidth: toNum(m.bottomWidth),
    armhole: toNum(m.armhole),
    wrist: toNum(m.wrist),
    customMeasurements: m.customMeasurements ?? [],
    notes: m.notes ?? undefined,
    createdAt: m.createdAt,
  };
}

// Convert API invoice → local Invoice shape
function apiToInvoice(i: ApiInvoice): Invoice {
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    orderLabel: i.orderLabel,
    tailorId: i.tailorId,
    customerId: i.customerId,
    customerName: i.customerName,
    customerMobile: i.customerMobile,
    // Defensive: the API usually returns `items`, but a few endpoints return
    // only the invoice header. Default to an empty list rather than crashing.
    items: (i.items ?? []).map((it) => ({
      productType: it.productType,
      quantity: it.quantity,
      price: Number(it.price),
      measurementId: it.measurementId ?? undefined,
      measurementValues: it.measurementValues ?? undefined,
    })),
    subtotal: Number(i.subtotal),
    gstRate: Number(i.gstRate),
    gstAmount: Number(i.gstAmount),
    total: Number(i.total),
    status: i.status,
    notes: i.notes ?? undefined,
    createdAt: i.createdAt,
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCustomers([]);
      setMeasurements([]);
      setInvoices([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [customersData, measurementsData, invoicesData] = await Promise.all([
        api().listCustomers(),
        api().listMeasurements(),
        api().listInvoices(),
      ]);
      setCustomers(customersData.map(apiToCustomer));
      setMeasurements(measurementsData.map(apiToMeasurement));
      setInvoices(invoicesData.map(apiToInvoice));
    } catch (err) {
      console.error("[DataContext] refresh failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addCustomer(data: Omit<Customer, "id" | "tailorId" | "createdAt">) {
    const created = await api().createCustomer({
      name: data.name,
      mobile: data.mobile,
      email: data.email ?? null,
      address: data.address ?? null,
      notes: data.notes ?? null,
    });
    const local = apiToCustomer(created);
    setCustomers((prev) => [local, ...prev]);
    return local;
  }

  async function updateCustomer(id: string, data: Partial<Customer>) {
    const updated = await api().updateCustomer(id, {
      name: data.name,
      mobile: data.mobile,
      email: data.email ?? null,
      address: data.address ?? null,
      notes: data.notes ?? null,
    });
    const local = apiToCustomer(updated);
    setCustomers((prev) => prev.map((c) => (c.id === id ? local : c)));
  }

  async function deleteCustomer(id: string) {
    await api().deleteCustomer(id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    // Also remove their measurements and invoices from local state so the
    // UI is consistent (the server cascades the delete).
    setMeasurements((prev) => prev.filter((m) => m.customerId !== id));
    setInvoices((prev) => prev.filter((i) => i.customerId !== id));
  }

  async function addMeasurement(data: Omit<Measurement, "id" | "tailorId" | "createdAt">) {
    if (!user) throw new Error("Not authenticated");
    // The API expects the same fields our local shape uses. We always provide
    // an explicit "chest"/etc. as either a number (which we stringify) or
    // null/undefined. The server will accept the body as-is.
    const payload: any = {
      customerId: data.customerId,
      productType: data.productType,
      measurementDate: data.date,
    };
    const fields: (keyof Measurement)[] = [
      "chest", "shoulder", "neck", "sleeve",
      "waist", "length", "hip", "thigh",
      "pantLength", "bottomWidth", "armhole", "wrist",
    ];
    for (const f of fields) {
      const v = (data as any)[f];
      if (v != null && !Number.isNaN(v)) {
        payload[f] = String(v);
      } else {
        payload[f] = null;
      }
    }
    if (data.customMeasurements && data.customMeasurements.length > 0) {
      payload.customMeasurements = data.customMeasurements;
    }
    if (data.notes) {
      payload.notes = data.notes;
    }

    const created = await api().createMeasurement(payload);
    const local = apiToMeasurement(created);
    setMeasurements((prev) => [local, ...prev]);
    return local;
  }

  async function deleteMeasurement(id: string) {
    await api().deleteMeasurement(id);
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  }

  async function createInvoice(data: {
    customerId: string;
    customerName: string;
    customerMobile: string;
    items: InvoiceItem[];
    gstRate: number;
    notes?: string;
  }) {
    if (!user) throw new Error("Not authenticated");
    const created = await api().createInvoice({
      customerId: data.customerId,
      customerName: data.customerName,
      customerMobile: data.customerMobile,
      gstRate: data.gstRate,
      notes: data.notes,
      items: data.items.map((it) => ({
        productType: it.productType,
        quantity: it.quantity,
        price: it.price,
        measurementId: it.measurementId ?? null,
        measurementValues: it.measurementValues ?? null,
      })),
    });
    const local = apiToInvoice(created);
    setInvoices((prev) => [local, ...prev]);
    return local;
  }

  async function updateInvoiceStatus(id: string, status: Invoice["status"]) {
    const updated = await api().updateInvoiceStatus(id, status);
    const local = apiToInvoice(updated);
    setInvoices((prev) => prev.map((i) => (i.id === id ? local : i)));
  }

  function getCustomerMeasurements(customerId: string) {
    return measurements.filter((m) => m.customerId === customerId);
  }

  function getCustomerInvoices(customerId: string) {
    return invoices.filter((i) => i.customerId === customerId);
  }

  function getCustomerMeasurementForProduct(customerId: string, productType: string) {
    const matches = measurements.filter(
      (m) => m.customerId === customerId && m.productType === productType,
    );
    if (matches.length === 0) {
      console.log(
        `[DataContext] getCustomerMeasurementForProduct → no measurement found for customer=${customerId} product=${productType}`,
      );
      // Fall through and try the server: this handles the "fresh login, no
      // local data yet" race, where the order screen mounts before the
      // measurements list has finished loading.
      // We can't await here (this is a sync function), so the consumer
      // should also call fetchLatestMeasurement(...) when no local match
      // is found. The auto-fill effect does this — see invoices/new.tsx.
      return undefined;
    }
    const sorted = [...matches].sort((a, b) => {
      const ad = new Date(a.date || a.createdAt).getTime();
      const bd = new Date(b.date || b.createdAt).getTime();
      if (bd !== ad) return bd - ad;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    const latest = sorted[0];
    console.log(
      `[DataContext] getCustomerMeasurementForProduct → customer=${customerId} product=${productType} selectedId=${latest.id} totalMatches=${matches.length}`,
    );
    return latest;
  }

  /**
   * Fetch the latest measurement directly from the server for a (customer,
   * product) pair. Used when the local list is empty but the server may
   * still have data — e.g. right after a fresh login.
   */
  async function fetchLatestMeasurement(customerId: string, productType: string): Promise<Measurement | null> {
    if (!customerId || !productType) return null;
    try {
      const data = await api().getLatestMeasurement(customerId, productType);
      const local = apiToMeasurement(data);
      // Cache it in local state for next time
      setMeasurements((prev) => {
        if (prev.some((m) => m.id === local.id)) return prev;
        return [local, ...prev];
      });
      return local;
    } catch (err) {
      // 404 just means "no measurement yet" — not an error worth surfacing.
      console.log(
        `[DataContext] fetchLatestMeasurement → no measurement for customer=${customerId} product=${productType}`,
      );
      return null;
    }
  }

  return (
    <DataContext.Provider
      value={{
        customers,
        measurements,
        invoices,
        isLoading,
        refresh,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addMeasurement,
        deleteMeasurement,
        createInvoice,
        updateInvoiceStatus,
        getCustomerMeasurements,
        getCustomerInvoices,
        getCustomerMeasurementForProduct,
        fetchLatestMeasurement,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
