export type UserRole = "admin" | "tailor";
export type UserStatus = "pending" | "approved" | "rejected";
export type InvoiceStatus = "pending" | "completed" | "cancelled";
// Customer gender is now only male / female (per the 0006 enhancements).
// Tailor `speciality` keeps `unisex` for cross-gender tailors.
export type Gender = "male" | "female" | "unisex";
export type Speciality = "male" | "female" | "unisex";
export type Relation =
  | "father" | "mother" | "son" | "daughter"
  | "wife" | "husband" | "brother" | "sister" | "other";
export type MeasurementUnit = "inches" | "cm";
export type PreferredLanguage = "en" | "hi" | "gu";

/** Sub-type / feature option for a product (e.g. "Half Boy Shirt", "V-Type Kurta") */
export interface ProductFeature {
  label: string;
  /** Which gender this feature applies to; undefined means all genders. */
  gender?: "male" | "female" | "both";
}

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
  /** ISO-639-1 language code — drives the i18n locale on app load. */
  preferredLanguage?: PreferredLanguage;
  /** Tailor shop GPS coordinates captured during registration / profile. */
  latitude?: number | null;
  longitude?: number | null;
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
  /** New in 0006 — language / GPS captured during registration. */
  preferredLanguage?: PreferredLanguage;
  latitude?: number;
  longitude?: number;
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
  /** New in 0006 — language / GPS for the shop. */
  preferredLanguage?: PreferredLanguage;
  latitude?: number | null;
  longitude?: number | null;
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
  /** New in 0006 — optional GPS for the customer's location. */
  latitude?: number | null;
  longitude?: number | null;
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
  /** New in 0006 — body-measurement unit for this product. */
  unit?: MeasurementUnit;
  /** Sub-type feature options (e.g. "Half Boy Shirt", "V-Type Kurta") */
  features?: ProductFeature[];
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
  /** Optional sub-type/feature selected at measurement time */
  featureLabel?: string | null;
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
  featureLabel?: string | null;
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
  orderId?: string | null;
  tailorId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  items: InvoiceItem[];
  subtotal: number;
  total: number;
  /** Amount already paid (advance) carried over from the order */
  paidAmount?: number;
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

// ── Orders ─────────────────────────────────────────────────────────────
export type OrderStatus = "pending" | "completed" | "cancelled";

export interface OrderItem {
  id: string;
  orderId: string;
  productTypeId?: string | null;
  productType: string;
  featureLabel?: string | null;
  quantity: number;
  price: number;
  measurementId?: string | null;
  familyMemberId?: string | null;
  personName?: string | null;
  relation?: string | null;
  measurementValues?: Record<string, string> | null;
  invoiceId?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  tailorId: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  status: OrderStatus;
  deliveryDate?: string | null;
  notes?: string | null;
  totalAmount: number;
  /** Advance / deposit paid at the time of order creation */
  advanceAmount?: number;
  /** Remaining balance = totalAmount - advanceAmount */
  balanceDue?: number;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}
