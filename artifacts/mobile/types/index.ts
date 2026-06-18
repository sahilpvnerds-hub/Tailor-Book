export type UserRole = "admin" | "tailor";
export type UserStatus = "pending" | "approved" | "rejected";
export type InvoiceStatus = "pending" | "completed" | "cancelled";
export type Gender = "male" | "female" | "unisex";
export type Speciality = "male" | "female" | "unisex";
export type Relation =
  | "father" | "mother" | "son" | "daughter"
  | "wife" | "husband" | "brother" | "sister" | "other";

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  speciality?: Speciality;
  shopName?: string;
  shopAddress?: string;
  city?: string;
  state?: string;
  avatarUri?: string;
  status: UserStatus;
  emailVerifiedAt?: string | null;
  onboardingComplete?: boolean;
  createdAt: string;
}

export interface RegisterData {
  name: string;
  email: string;
  mobile: string;
  password: string;
  speciality?: Speciality;
  shopName?: string;
  shopAddress?: string;
  city?: string;
  state?: string;
  emailVerifiedAt?: string;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  mobile?: string;
  shopName?: string;
  shopAddress?: string;
  city?: string;
  state?: string;
  avatarUri?: string;
  speciality?: Speciality;
  onboardingComplete?: boolean;
}

export interface Customer {
  id: string;
  tailorId: string;
  familyId?: string;
  name: string;
  mobile: string;
  gender: Gender;
  email?: string;
  address?: string;
  notes?: string;
  profilePicture?: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  tailorId: string;
  primaryCustomerId: string;
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
  familyMemberId?: string | null;
  familyMemberName?: string;
  measurementSessionId?: string;
  tailorId: string;
  customerName: string;
  date: string;
  measurementDate?: string;
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
  photos?: string[];
  createdAt: string;
}

export interface InvoiceItem {
  productType: string;
  productTypeId?: string;
  quantity: number;
  price: number;
  measurementId?: string;
  measurementValues?: Record<string, string>;
  /** ID of the family member this item belongs to (undefined = primary customer) */
  familyMemberId?: string | null;
  /** Display name of the family member (or primary customer name) */
  familyMemberName?: string;
  /** Persisted display name for invoices/PDFs/API responses */
  personName?: string | null;
  /** Persisted relation label, "self" for the primary customer */
  relation?: Relation | "self" | string | null;
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
  deliveryDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  tailorId: string;
  title: string;
  message: string;
  isRead: boolean;
  type: "delivery_due_today" | "delivery_due_tomorrow" | "delivery_overdue" | "pending_invoice" | "general";
  relatedId?: string;
  deliveryDate?: string;   // ISO string – used for countdown calculation
  /** Invoice this notification belongs to */
  invoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  customerMobile?: string;
  /** Comma-separated product types e.g. ["Shirt", "Pant"] */
  itemTypes?: string[];
  createdAt: string;
}


// ── Pending OTP (transient, per-registration) ───────────────────────────
export interface PendingOtp {
  email: string;
  otp: string;
  expiresAt: number; // epoch ms
  formData: Record<string, string>;
}
