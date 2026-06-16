export type UserRole = "admin" | "tailor";
export type UserStatus = "pending" | "approved" | "rejected";
export type InvoiceStatus = "pending" | "completed" | "cancelled";
export type Gender = "male" | "female" | "unisex";
export type Speciality = "male" | "female" | "unisex";
export type Relation = "father" | "mother" | "son" | "daughter" | "wife" | "husband" | "other";

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
  speciality?: Speciality;
  shopName?: string;
  shopAddress?: string;
  city?: string;
  state?: string;
  avatarUri?: string;
  status: UserStatus;
  onboardingComplete?: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  tailorId: string;
  name: string;
  mobile: string;
  gender: Gender;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  customerId: string;
  tailorId: string;
  name: string;
  relation: Relation;
  gender: Gender;
  createdAt: string;
}

export interface ProductType {
  id: string;
  tailorId: string;
  name: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeasurementField {
  label: string;
  value: number;
}

export interface CustomMeasurementField {
  id: string;
  tailorId: string;
  fieldName: string;
  createdAt: string;
}

export interface Measurement {
  id: string;
  customerId: string;
  tailorId: string;
  customerName: string;
  date: string;
  deliveryDate?: string;
  productType: string;
  productTypeId?: string;
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
  productTypeId?: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderLabel: string;
  tailorId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  items: InvoiceItem[];
  subtotal: number;
  total: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  tailorId: string;
  title: string;
  message: string;
  isRead: boolean;
  type: "delivery_due_today" | "delivery_due_tomorrow" | "pending_invoice" | "general";
  relatedId?: string;
  createdAt: string;
}
