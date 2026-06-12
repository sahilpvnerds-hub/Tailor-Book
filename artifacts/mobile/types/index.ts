export type UserRole = "admin" | "tailor";
export type UserStatus = "pending" | "approved" | "rejected";
export type InvoiceStatus = "pending" | "completed" | "cancelled";

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
  shopName?: string;
  shopAddress?: string;
  city?: string;
  state?: string;
  status: UserStatus;
  createdAt: string;
}

export interface Customer {
  id: string;
  tailorId: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface MeasurementField {
  label: string;
  value: number;
}

export interface Measurement {
  id: string;
  customerId: string;
  tailorId: string;
  customerName: string;
  date: string;
  productType: string;
  chest?: number;
  shoulder?: number;
  neck?: number;
  sleeve?: number;
  waist?: number;
  length?: number;
  hip?: number;
  thigh?: number;
  pantLength?: number;
  bottomWidth?: number;
  armhole?: number;
  wrist?: number;
  customMeasurements: MeasurementField[];
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  productType: string;
  quantity: number;
  price: number;
  measurementId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tailorId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  items: InvoiceItem[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
}
