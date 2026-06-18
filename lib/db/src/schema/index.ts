import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  date,
  json,
  boolean,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Core tables
// ---------------------------------------------------------------------------

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  mobile: varchar("mobile", { length: 20 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "tailor"]).notNull().default("tailor"),
  speciality: mysqlEnum("speciality", ["male", "female", "unisex"]),
  shopName: varchar("shop_name", { length: 150 }),
  shopAddress: varchar("shop_address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  avatarUri: text("avatar_uri"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  emailVerifiedAt: timestamp("email_verified_at"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const customers = mysqlTable("customers", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  familyId: varchar("family_id", { length: 36 }),
  name: varchar("name", { length: 100 }).notNull(),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  gender: mysqlEnum("gender", ["male", "female", "unisex"]).notNull().default("unisex"),
  email: varchar("email", { length: 150 }),
  address: text("address"),
  notes: text("notes"),
  profilePicture: text("profile_picture"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Family members belong to a "primary" customer (the account holder) so the
// whole family can be invoiced under one umbrella.
export const familyMembers = mysqlTable("family_members", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  primaryCustomerId: varchar("primary_customer_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  relation: mysqlEnum("relation", [
    "father", "mother", "son", "daughter", "wife", "husband", "brother", "sister", "other",
  ]).notNull().default("other"),
  gender: mysqlEnum("gender", ["male", "female", "unisex"]).notNull().default("unisex"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Per-tailor product-type master (shirt, pant, kurta, etc.)
export const productTypes = mysqlTable("product_types", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// Per-tailor custom measurement field names ("Cuff", "Bicep", etc.) that the
// tailor can attach to any measurement in addition to the standard fields.
export const customMeasurementFields = mysqlTable("custom_measurement_fields", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const measurements = mysqlTable("measurements", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  customerId: varchar("customer_id", { length: 36 }).notNull(),
  familyMemberId: varchar("family_member_id", { length: 36 }),
  measurementSessionId: varchar("measurement_session_id", { length: 36 }),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  productType: varchar("product_type", { length: 50 }).notNull(),
  measurementDate: date("measurement_date").notNull(),
  deliveryDate: date("delivery_date"),

  // Body measurements (inches) — optional
  chest: decimal("chest", { precision: 6, scale: 2 }),
  shoulder: decimal("shoulder", { precision: 6, scale: 2 }),
  neck: decimal("neck", { precision: 6, scale: 2 }),
  sleeve: decimal("sleeve", { precision: 6, scale: 2 }),
  waist: decimal("waist", { precision: 6, scale: 2 }),
  length: decimal("length", { precision: 6, scale: 2 }),
  hip: decimal("hip", { precision: 6, scale: 2 }),
  thigh: decimal("thigh", { precision: 6, scale: 2 }),
  pantLength: decimal("pant_length", { precision: 6, scale: 2 }),
  bottomWidth: decimal("bottom_width", { precision: 6, scale: 2 }),
  armhole: decimal("armhole", { precision: 6, scale: 2 }),
  wrist: decimal("wrist", { precision: 6, scale: 2 }),

  // Free-form extra measurements stored as JSON array
  customMeasurements: json("custom_measurements").$type<{ label: string; value: number }[]>().default([]),

  notes: text("notes"),
  // base64-encoded photo strings (local-storage friendly)
  photos: json("photos").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const measurementSessions = mysqlTable("measurement_sessions", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  customerId: varchar("customer_id", { length: 36 }).notNull(),
  familyMemberId: varchar("family_member_id", { length: 36 }),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  measurementDate: date("measurement_date").notNull(),
  deliveryDate: date("delivery_date"),
  notes: text("notes"),
  photos: json("photos").$type<string[]>().default([]),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const measurementItems = mysqlTable("measurement_items", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  measurementSessionId: varchar("measurement_session_id", { length: 36 }).notNull(),
  productTypeId: varchar("product_type_id", { length: 36 }),
  productType: varchar("product_type", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const measurementValues = mysqlTable("measurement_values", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  measurementItemId: varchar("measurement_item_id", { length: 36 }).notNull(),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  fieldValue: decimal("field_value", { precision: 8, scale: 2 }).notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 20 }).notNull().unique(),
  orderLabel: varchar("order_label", { length: 20 }).notNull().unique(),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  customerId: varchar("customer_id", { length: 36 }).notNull(),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  customerMobile: varchar("customer_mobile", { length: 20 }).notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  status: mysqlEnum("status", ["pending", "completed", "cancelled"]).notNull().default("pending"),
  deliveryDate: date("delivery_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const invoiceItems = mysqlTable("invoice_items", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  invoiceId: varchar("invoice_id", { length: 36 }).notNull(),
  productType: varchar("product_type", { length: 50 }).notNull(),
  quantity: int("quantity").notNull().default(1),
  price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0"),
  measurementId: varchar("measurement_id", { length: 36 }),
  familyMemberId: varchar("family_member_id", { length: 36 }),
  personName: varchar("person_name", { length: 100 }),
  relation: varchar("relation", { length: 50 }),
  measurementValues: json("measurement_values").$type<Record<string, string>>(),
  position: int("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const counters = mysqlTable("counters", {
  name: varchar("name", { length: 50 }).notNull().primaryKey(),
  value: int("value").notNull().default(0),
});

export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", [
    "delivery_due_today", "delivery_due_tomorrow", "pending_invoice", "general",
  ]).notNull().default("general"),
  relatedId: varchar("related_id", { length: 36 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Email-OTP records generated during the registration flow. They have a TTL
// and an attempt counter so we can rate-limit and expire them. The latest OTP
// for a given email wins — older rows for the same email can be deleted.
export const pendingOtps = mysqlTable("pending_otps", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  email: varchar("email", { length: 150 }).notNull(),
  otp: varchar("otp", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: int("attempts").notNull().default(0),
  consumed: boolean("consumed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Zod insert schemas for input validation
// ---------------------------------------------------------------------------
// We build insert schemas from the drizzle table definitions. `createInsertSchema`
// returns a ZodObject that we can chain `.omit()` on to exclude auto-generated
// columns that the client should not supply (id, timestamps, etc.).
// ---------------------------------------------------------------------------
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  tailorId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  tailorId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductTypeSchema = createInsertSchema(productTypes).omit({
  id: true,
  tailorId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomMeasurementFieldSchema = createInsertSchema(customMeasurementFields).omit({
  id: true,
  tailorId: true,
  createdAt: true,
});

export const insertMeasurementSchema = createInsertSchema(measurements).omit({
  id: true,
  customerId: true,
  tailorId: true,
  customerName: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMeasurementSessionSchema = createInsertSchema(measurementSessions).omit({
  id: true,
  tailorId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMeasurementItemSchema = createInsertSchema(measurementItems).omit({
  id: true,
  createdAt: true,
});

export const insertMeasurementValueSchema = createInsertSchema(measurementValues).omit({
  id: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
  createdAt: true,
});

export const insertCounterSchema = createInsertSchema(counters);

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  tailorId: true,
  createdAt: true,
});

// ---------------------------------------------------------------------------
// TypeScript types inferred from the Drizzle table definitions
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type ProductType = typeof productTypes.$inferSelect;
export type CustomMeasurementField = typeof customMeasurementFields.$inferSelect;
export type Measurement = typeof measurements.$inferSelect;
export type MeasurementSession = typeof measurementSessions.$inferSelect;
export type MeasurementItem = typeof measurementItems.$inferSelect;
export type MeasurementValue = typeof measurementValues.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Counter = typeof counters.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type PendingOtp = typeof pendingOtps.$inferSelect;
