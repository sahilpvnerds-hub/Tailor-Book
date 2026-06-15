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
  shopName: varchar("shop_name", { length: 150 }),
  shopAddress: varchar("shop_address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  avatarUri: text("avatar_uri"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const customers = mysqlTable("customers", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  email: varchar("email", { length: 150 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const measurements = mysqlTable("measurements", {
  id: varchar("id", { length: 36 }).notNull().primaryKey(),
  customerId: varchar("customer_id", { length: 36 }).notNull(),
  tailorId: varchar("tailor_id", { length: 36 }).notNull(),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  productType: varchar("product_type", { length: 50 }).notNull(),
  measurementDate: date("measurement_date").notNull(),

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
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
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  gstAmount: decimal("gst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  status: mysqlEnum("status", ["pending", "completed", "cancelled"]).notNull().default("pending"),
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
  measurementValues: json("measurement_values").$type<Record<string, string>>(),
  position: int("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const counters = mysqlTable("counters", {
  name: varchar("name", { length: 50 }).notNull().primaryKey(),
  value: int("value").notNull().default(0),
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

export const insertMeasurementSchema = createInsertSchema(measurements).omit({
  id: true,
  customerId: true,
  tailorId: true,
  customerName: true,
  createdAt: true,
  updatedAt: true,
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

// ---------------------------------------------------------------------------
// TypeScript types inferred from the Drizzle table definitions
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Measurement = typeof measurements.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Counter = typeof counters.$inferSelect;
