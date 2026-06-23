-- =============================================================================
-- Tailor Book - MySQL Database Schema (Complete / Fresh Install)
-- =============================================================================
-- Database: tailorbook
-- Connection: localhost:3306, user: root, password: admin123
-- Engine:    InnoDB
-- Charset:   utf8mb4 (full Unicode support including emojis)
-- Collation: utf8mb4_unicode_ci
-- =============================================================================
-- Run this file once on a fresh MySQL instance. It creates every table used
-- by the Drizzle ORM schema and seeds a working admin account.
-- =============================================================================

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS tailorbook
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Use the database
USE tailorbook;

-- =============================================================================
-- Table: users
-- Stores admin and tailor accounts.
-- Includes v2 columns: speciality, email_verified_at, onboarding_complete
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id                  VARCHAR(36)   NOT NULL PRIMARY KEY,
  name                VARCHAR(100)  NOT NULL,
  email               VARCHAR(150)  NOT NULL UNIQUE,
  mobile              VARCHAR(20)   NOT NULL UNIQUE,
  password            VARCHAR(255)  NOT NULL,
  role                ENUM('admin', 'tailor') NOT NULL DEFAULT 'tailor',
  speciality          VARCHAR(200)  NULL,
  shop_name           VARCHAR(150)  NULL,
  shop_address        VARCHAR(255)  NULL,
  city                VARCHAR(100)  NULL,
  state               VARCHAR(100)  NULL,
  avatar_uri          TEXT          NULL,
  status              ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  email_verified_at   TIMESTAMP     NULL,
  onboarding_complete BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_users_role   (role),
  INDEX idx_users_status (status),
  INDEX idx_users_email  (email),
  INDEX idx_users_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: customers
-- Tailor's customers. Each customer belongs to a tailor (tailor_id).
-- =============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  tailor_id       VARCHAR(36)  NOT NULL,
  family_id       VARCHAR(36)  NULL,
  name            VARCHAR(100) NOT NULL,
  mobile          VARCHAR(20)  NOT NULL,
  gender          ENUM('male','female','unisex') NOT NULL DEFAULT 'unisex',
  email           VARCHAR(150) NULL,
  address         TEXT         NULL,
  notes           TEXT         NULL,
  profile_picture TEXT         NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_customers_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_customers_tailor (tailor_id),
  INDEX idx_customers_family (family_id),
  INDEX idx_customers_mobile (mobile),
  INDEX idx_customers_name   (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: family_members
-- Family members grouped under a primary customer.
-- =============================================================================
CREATE TABLE IF NOT EXISTS family_members (
  id                  VARCHAR(36)  NOT NULL PRIMARY KEY,
  tailor_id           VARCHAR(36)  NOT NULL,
  primary_customer_id VARCHAR(36)  NOT NULL,
  name                VARCHAR(100) NOT NULL,
  relation            ENUM('father','mother','son','daughter','wife','husband','brother','sister','other') NOT NULL DEFAULT 'other',
  gender              ENUM('male','female','unisex') NOT NULL DEFAULT 'unisex',
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_family_members_tailor  (tailor_id),
  INDEX idx_family_members_primary (primary_customer_id),

  CONSTRAINT fk_family_members_primary_customer
    FOREIGN KEY (primary_customer_id) REFERENCES customers(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: product_types
-- Per-tailor master list of garment types (shirt, pant, kurta, etc.).
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_types (
  id         VARCHAR(36)    NOT NULL PRIMARY KEY,
  tailor_id  VARCHAR(36)    NOT NULL,
  name       VARCHAR(100)   NOT NULL,
  amount     DECIMAL(12,2)  NOT NULL DEFAULT 0,
  unit       ENUM('inches','cm') NOT NULL DEFAULT 'inches',
  -- Features/sub-types: JSON array of { label: string, gender?: 'male'|'female'|'both' }
  features   JSON           NULL,
  created_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_product_types_tailor (tailor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: custom_measurement_fields
-- Per-tailor extra measurement field names (e.g. "Cuff", "Bicep").
-- =============================================================================
CREATE TABLE IF NOT EXISTS custom_measurement_fields (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  tailor_id  VARCHAR(36)  NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_custom_fields_tailor (tailor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: measurements
-- Customer body measurements. One row per (customer + product type + date).
-- =============================================================================
CREATE TABLE IF NOT EXISTS measurements (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  customer_id     VARCHAR(36)  NOT NULL,
  family_member_id VARCHAR(36) NULL,
  measurement_session_id VARCHAR(36) NULL,
  tailor_id       VARCHAR(36)  NOT NULL,
  customer_name   VARCHAR(100) NOT NULL,
  product_type    VARCHAR(50)  NOT NULL,
  feature_label   VARCHAR(100) NULL,
  measurement_date DATE        NOT NULL,
  delivery_date   DATE         NULL,

  -- Body measurement fields (inches)
  chest        DECIMAL(6,2) NULL,
  shoulder     DECIMAL(6,2) NULL,
  neck         DECIMAL(6,2) NULL,
  sleeve       DECIMAL(6,2) NULL,
  waist        DECIMAL(6,2) NULL,
  length       DECIMAL(6,2) NULL,
  hip          DECIMAL(6,2) NULL,
  thigh        DECIMAL(6,2) NULL,
  pant_length  DECIMAL(6,2) NULL,
  bottom_width DECIMAL(6,2) NULL,
  armhole      DECIMAL(6,2) NULL,
  wrist        DECIMAL(6,2) NULL,

  -- Free-form extra measurements (JSON array of {label, value})
  custom_measurements JSON NULL,

  notes       TEXT NULL,
  photos      JSON NULL DEFAULT ('[]'),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_measurements_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_measurements_family_member
    FOREIGN KEY (family_member_id) REFERENCES family_members(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_measurements_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_measurements_customer (customer_id),
  INDEX idx_measurements_family_member (family_member_id),
  INDEX idx_measurements_session  (measurement_session_id),
  INDEX idx_measurements_tailor   (tailor_id),
  INDEX idx_measurements_product  (customer_id, product_type),
  INDEX idx_measurements_date     (measurement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Tables: measurement_sessions, measurement_items, measurement_values
-- Normalized multi-product measurement sessions. Legacy measurements rows remain
-- for backward compatibility with existing screens and invoices.
-- =============================================================================
CREATE TABLE IF NOT EXISTS measurement_sessions (
  id                  VARCHAR(36) NOT NULL PRIMARY KEY,
  customer_id          VARCHAR(36) NOT NULL,
  family_member_id     VARCHAR(36) NULL,
  tailor_id            VARCHAR(36) NOT NULL,
  measurement_date     DATE NOT NULL,
  delivery_date        DATE NULL,
  notes                TEXT NULL,
  photos               JSON NULL DEFAULT ('[]'),
  created_by           VARCHAR(36) NOT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_measurement_sessions_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_measurement_sessions_family_member
    FOREIGN KEY (family_member_id) REFERENCES family_members(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_measurement_sessions_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_measurement_sessions_customer (customer_id),
  INDEX idx_measurement_sessions_family_member (family_member_id),
  INDEX idx_measurement_sessions_tailor (tailor_id),
  INDEX idx_measurement_sessions_date (measurement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS measurement_items (
  id                      VARCHAR(36) NOT NULL PRIMARY KEY,
  measurement_session_id  VARCHAR(36) NOT NULL,
  product_type_id         VARCHAR(36) NULL,
  product_type            VARCHAR(100) NOT NULL,
  feature_label           VARCHAR(100) NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_measurement_items_session
    FOREIGN KEY (measurement_session_id) REFERENCES measurement_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_measurement_items_product_type
    FOREIGN KEY (product_type_id) REFERENCES product_types(id)
    ON DELETE SET NULL,

  INDEX idx_measurement_items_session (measurement_session_id),
  INDEX idx_measurement_items_product_type (product_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS measurement_values (
  id                   VARCHAR(36) NOT NULL PRIMARY KEY,
  measurement_item_id  VARCHAR(36) NOT NULL,
  field_name           VARCHAR(100) NOT NULL,
  field_value          DECIMAL(8,2) NOT NULL,

  CONSTRAINT fk_measurement_values_item
    FOREIGN KEY (measurement_item_id) REFERENCES measurement_items(id)
    ON DELETE CASCADE,

  INDEX idx_measurement_values_item (measurement_item_id),
  INDEX idx_measurement_values_field (field_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: orders
-- Stores family/individual orders.
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  order_number     VARCHAR(20)   NOT NULL UNIQUE,
  tailor_id        VARCHAR(36)   NOT NULL,
  customer_id      VARCHAR(36)   NOT NULL,
  customer_name    VARCHAR(100)  NOT NULL,
  customer_mobile  VARCHAR(20)   NOT NULL,
  status           ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  delivery_date    DATE          NULL,
  notes            TEXT          NULL,
  total_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_orders_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE,

  INDEX idx_orders_tailor   (tailor_id),
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_status   (status),
  INDEX idx_orders_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: order_items
-- Garments included in an order.
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
  order_id           VARCHAR(36)   NOT NULL,
  product_type_id    VARCHAR(36)   NULL,
  product_type       VARCHAR(50)   NOT NULL,
  feature_label      VARCHAR(100)  NULL,
  quantity           INT           NOT NULL DEFAULT 1,
  price              DECIMAL(12,2) NOT NULL DEFAULT 0,
  measurement_id     VARCHAR(36)   NULL,
  family_member_id   VARCHAR(36)   NULL,
  person_name        VARCHAR(100)  NULL,
  relation           VARCHAR(50)   NULL,
  measurement_values JSON          NULL,
  invoice_id         VARCHAR(36)   NULL,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_measurement
    FOREIGN KEY (measurement_id) REFERENCES measurements(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_order_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_order_items_family_member
    FOREIGN KEY (family_member_id) REFERENCES family_members(id)
    ON DELETE CASCADE,

  INDEX idx_order_items_order         (order_id),
  INDEX idx_order_items_product_type  (product_type_id),
  INDEX idx_order_items_family_member (family_member_id),
  INDEX idx_order_items_measurement   (measurement_id),
  INDEX idx_order_items_invoice       (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: invoices
-- Orders / bills. Each invoice has many items.
-- =============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  invoice_number   VARCHAR(20)   NOT NULL UNIQUE,
  order_label      VARCHAR(20)   NOT NULL UNIQUE,
  order_id         VARCHAR(36)   NULL,
  tailor_id        VARCHAR(36)   NOT NULL,
  customer_id      VARCHAR(36)   NOT NULL,
  customer_name    VARCHAR(100)  NOT NULL,
  customer_mobile  VARCHAR(20)   NOT NULL,
  subtotal         DECIMAL(12,2) NOT NULL DEFAULT 0,
  total            DECIMAL(12,2) NOT NULL DEFAULT 0,
  status           ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  delivery_date    DATE          NULL,
  notes            TEXT          NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_invoices_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_invoices_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE,

  INDEX idx_invoices_tailor   (tailor_id),
  INDEX idx_invoices_customer (customer_id),
  INDEX idx_invoices_status   (status),
  INDEX idx_invoices_order    (order_id),
  INDEX idx_invoices_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: invoice_items
-- Line items inside an invoice.
-- =============================================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
  invoice_id         VARCHAR(36)   NOT NULL,
  product_type_id    VARCHAR(36)   NULL,
  product_type       VARCHAR(50)   NOT NULL,
  feature_label      VARCHAR(100)  NULL,
  quantity           INT           NOT NULL DEFAULT 1,
  price              DECIMAL(12,2) NOT NULL DEFAULT 0,
  measurement_id     VARCHAR(36)   NULL,
  family_member_id   VARCHAR(36)   NULL,
  person_name        VARCHAR(100)  NULL,
  relation           VARCHAR(50)   NULL,
  measurement_values JSON          NULL,
  position           INT           NOT NULL DEFAULT 0,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_measurement
    FOREIGN KEY (measurement_id) REFERENCES measurements(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_invoice_items_family_member
    FOREIGN KEY (family_member_id) REFERENCES family_members(id)
    ON DELETE CASCADE,

  INDEX idx_invoice_items_invoice     (invoice_id),
  INDEX idx_invoice_items_product_type (product_type_id),
  INDEX idx_invoice_items_family_member (family_member_id),
  INDEX idx_invoice_items_measurement (measurement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: counters
-- Single-row table for sequential ID generation.
-- =============================================================================
CREATE TABLE IF NOT EXISTS counters (
  name  VARCHAR(50) NOT NULL PRIMARY KEY,
  value BIGINT      NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO counters (name, value) VALUES ('invoice', 0), ('order', 0)
  ON DUPLICATE KEY UPDATE value = value;


-- =============================================================================
-- Table: notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  tailor_id  VARCHAR(36)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  message    TEXT         NOT NULL,
  type       ENUM('delivery_due_today','delivery_due_tomorrow','pending_invoice','general') NOT NULL DEFAULT 'general',
  related_id VARCHAR(36)  NULL,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_notifications_tailor (tailor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: pending_otps
-- Short-lived OTPs for the email-verification registration flow.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pending_otps (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  email      VARCHAR(150) NOT NULL,
  otp        VARCHAR(6)   NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  attempts   INT          NOT NULL DEFAULT 0,
  consumed   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pending_otps_email (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: sessions (optional - for future session store)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id    VARCHAR(36)  NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_sessions_token (token),
  INDEX idx_sessions_user  (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Seed: Admin user
-- Password is stored as plain text here. The auth.ts login route has a
-- bcrypt-compare fallback that falls back to direct comparison when the
-- stored value is not a valid bcrypt hash, so plain text seeds always work.
-- After first login, update the password via the profile screen (it will then
-- be re-hashed by the API on next password change endpoint).
--
-- Credentials: admin@tailorbook.com / admin123
-- =============================================================================
INSERT INTO users (id, name, email, mobile, password, role, status, email_verified_at, onboarding_complete)
VALUES (
  'admin-0001',
  'Admin',
  'admin@tailorbook.com',
  '9999999999',
  'admin123',
  'admin',
  'approved',
  NOW(),
  TRUE
) ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status);


-- =============================================================================
-- Seed: Sample approved tailor (password: tailor123)
-- =============================================================================
INSERT INTO users (id, name, email, mobile, password, role, shop_name, status, email_verified_at, onboarding_complete)
VALUES (
  'tailor-0001',
  'Ramesh Kumar',
  'ramesh@tailor.com',
  '9876543210',
  'tailor123',
  'tailor',
  'Ramesh Tailors',
  'approved',
  NOW(),
  TRUE
) ON DUPLICATE KEY UPDATE name = VALUES(name);


-- =============================================================================
-- Seed: Sample customers for the demo tailor
-- =============================================================================
INSERT INTO customers (id, tailor_id, name, mobile, gender, email, address)
VALUES
  ('cust-0001', 'tailor-0001', 'Amit Patel',   '9123456700', 'male',   'amit@example.com',  '12 MG Road, Mumbai'),
  ('cust-0002', 'tailor-0001', 'Priya Sharma', '9123456701', 'female', 'priya@example.com', '45 Park Street, Delhi')
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- =============================================================================
-- Verify
-- =============================================================================
SHOW TABLES;
SELECT 'Schema created successfully' AS status;
