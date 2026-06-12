import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  generateId,
  getCustomers,
  getInvoices,
  getMeasurements,
  getNextInvoiceNumber,
  getNextOrderLabel,
  saveCustomers,
  saveInvoices,
  saveMeasurements,
  withOrderLabel,
} from "@/utils/storage";
import { Customer, Invoice, InvoiceItem, Measurement } from "@/types";
import { useAuth } from "./AuthContext";

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
}

const DataContext = createContext<DataContextType>({} as DataContextType);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const [c, m, i] = await Promise.all([getCustomers(), getMeasurements(), getInvoices()]);
    // Filter by tailorId (admin sees all)
    const filteredC = user.role === "admin" ? c : c.filter((x) => x.tailorId === user.id);
    const filteredM = user.role === "admin" ? m : m.filter((x) => x.tailorId === user.id);
    const filteredI = user.role === "admin" ? i : i.filter((x) => x.tailorId === user.id);
    // Migrate old invoices — ensure orderLabel is always present for backward compat.
    const migratedI = filteredI.map(withOrderLabel);
    setCustomers(filteredC);
    setMeasurements(filteredM);
    setInvoices(migratedI);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addCustomer(data: Omit<Customer, "id" | "tailorId" | "createdAt">) {
    if (!user) throw new Error("Not authenticated");
    const newCustomer: Customer = {
      ...data,
      id: generateId(),
      tailorId: user.id,
      createdAt: new Date().toISOString(),
    };
    const all = await getCustomers();
    await saveCustomers([...all, newCustomer]);
    setCustomers((prev) => [...prev, newCustomer]);
    return newCustomer;
  }

  async function updateCustomer(id: string, data: Partial<Customer>) {
    const all = await getCustomers();
    const updated = all.map((c) => (c.id === id ? { ...c, ...data } : c));
    await saveCustomers(updated);
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  }

  async function deleteCustomer(id: string) {
    const all = await getCustomers();
    await saveCustomers(all.filter((c) => c.id !== id));
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  async function addMeasurement(data: Omit<Measurement, "id" | "tailorId" | "createdAt">) {
    if (!user) throw new Error("Not authenticated");
    const m: Measurement = {
      ...data,
      id: generateId(),
      tailorId: user.id,
      createdAt: new Date().toISOString(),
    };
    const all = await getMeasurements();
    await saveMeasurements([...all, m]);
    setMeasurements((prev) => [...prev, m]);
    return m;
  }

  async function deleteMeasurement(id: string) {
    const all = await getMeasurements();
    await saveMeasurements(all.filter((m) => m.id !== id));
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
    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const gstAmount = (subtotal * data.gstRate) / 100;
    const total = subtotal + gstAmount;
    const invoiceNumber = await getNextInvoiceNumber();
    const orderLabel = await getNextOrderLabel();
    const inv: Invoice = {
      id: generateId(),
      invoiceNumber,
      orderLabel,
      tailorId: user.id,
      customerId: data.customerId,
      customerName: data.customerName,
      customerMobile: data.customerMobile,
      items: data.items,
      subtotal,
      gstRate: data.gstRate,
      gstAmount,
      total,
      status: "pending",
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };
    const all = await getInvoices();
    await saveInvoices([...all, inv]);
    setInvoices((prev) => [...prev, inv]);
    return inv;
  }

  async function updateInvoiceStatus(id: string, status: Invoice["status"]) {
    const all = await getInvoices();
    const updated = all.map((i) => (i.id === id ? { ...i, status } : i));
    await saveInvoices(updated);
    setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  function getCustomerMeasurements(customerId: string) {
    return measurements.filter((m) => m.customerId === customerId);
  }

  function getCustomerInvoices(customerId: string) {
    return invoices.filter((i) => i.customerId === customerId);
  }

  function getCustomerMeasurementForProduct(customerId: string, productType: string) {
    // Return the most-recent measurement for this customer+product combination.
    // We sort by `date` (when the measurement was taken) and then by `createdAt`
    // as a tie-breaker, so a newer record always wins even when dates are equal.
    const matches = measurements.filter(
      (m) => m.customerId === customerId && m.productType === productType,
    );
    if (matches.length === 0) {
      console.log(
        `[DataContext] getCustomerMeasurementForProduct → no measurement found for customer=${customerId} product=${productType}`,
      );
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
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
