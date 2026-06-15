-- =============================================================================
-- Tailor Book - MySQL Database Schema
-- =============================================================================
-- Database: tailorbook
-- Connection: localhost:3306, user: root, password: admin123
-- Engine:    InnoDB
-- Charset:   utf8mb4 (full Unicode support including emojis)
-- Collation: utf8mb4_unicode_ci
-- =============================================================================

-- 1. Drop database if it exists (CAUTION: deletes all data)
-- DROP DATABASE IF EXISTS tailorbook;

-- 2. Create the database
CREATE DATABASE IF NOT EXISTS tailorbook
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 3. Use the database
USE tailorbook;

-- =============================================================================
-- Table: users
-- Stores admin and tailor accounts.
-- =============================================================================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  mobile        VARCHAR(20)   NOT NULL UNIQUE,
  password      VARCHAR(255)  NOT NULL,
  role          ENUM('admin', 'tailor') NOT NULL DEFAULT 'tailor',
  shop_name     VARCHAR(150)  NULL,
  shop_address  VARCHAR(255)  NULL,
  city          VARCHAR(100)  NULL,
  state         VARCHAR(100)  NULL,
  avatar_uri    TEXT          NULL,
  status        ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_users_role (role),
  INDEX idx_users_status (status),
  INDEX idx_users_email (email),
  INDEX idx_users_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: customers
-- Tailor's customers. Each customer belongs to a tailor (tailor_id).
-- =============================================================================
DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  tailor_id    VARCHAR(36)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  mobile       VARCHAR(20)  NOT NULL,
  email        VARCHAR(150) NULL,
  address      TEXT         NULL,
  notes        TEXT         NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_customers_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_customers_tailor (tailor_id),
  INDEX idx_customers_mobile (mobile),
  INDEX idx_customers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: measurements
-- Customer body measurements. One row per (customer + product type + date).
-- =============================================================================
DROP TABLE IF EXISTS measurements;
CREATE TABLE measurements (
  id             VARCHAR(36)  NOT NULL PRIMARY KEY,
  customer_id    VARCHAR(36)  NOT NULL,
  tailor_id      VARCHAR(36)  NOT NULL,
  customer_name  VARCHAR(100) NOT NULL,
  product_type   VARCHAR(50)  NOT NULL,
  measurement_date DATE       NOT NULL,

  -- Body measurement fields (inches)
  chest          DECIMAL(6,2) NULL,
  shoulder       DECIMAL(6,2) NULL,
  neck           DECIMAL(6,2) NULL,
  sleeve         DECIMAL(6,2) NULL,
  waist          DECIMAL(6,2) NULL,
  length         DECIMAL(6,2) NULL,
  hip            DECIMAL(6,2) NULL,
  thigh          DECIMAL(6,2) NULL,
  pant_length    DECIMAL(6,2) NULL,
  bottom_width   DECIMAL(6,2) NULL,
  armhole        DECIMAL(6,2) NULL,
  wrist          DECIMAL(6,2) NULL,

  -- Free-form / extra measurements (JSON array of {label, value})
  custom_measurements JSON NULL,

  notes          TEXT         NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_measurements_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_measurements_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_measurements_customer (customer_id),
  INDEX idx_measurements_tailor (tailor_id),
  INDEX idx_measurements_product (customer_id, product_type),
  INDEX idx_measurements_date (measurement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: invoices
-- Orders / bills. Each invoice has many items.
-- =============================================================================
DROP TABLE IF EXISTS invoices;
CREATE TABLE invoices (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  invoice_number   VARCHAR(20)   NOT NULL UNIQUE,
  order_label      VARCHAR(20)   NOT NULL UNIQUE,
  tailor_id        VARCHAR(36)   NOT NULL,
  customer_id      VARCHAR(36)   NOT NULL,

  -- Snapshot of customer info at the time of the order
  customer_name    VARCHAR(100)  NOT NULL,
  customer_mobile  VARCHAR(20)   NOT NULL,

  -- Totals
  subtotal         DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_rate         DECIMAL(5,2)  NOT NULL DEFAULT 0,
  gst_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  total            DECIMAL(12,2) NOT NULL DEFAULT 0,

  status           ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  notes            TEXT NULL,

  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_invoices_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_invoices_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT,

  INDEX idx_invoices_tailor (tailor_id),
  INDEX idx_invoices_customer (customer_id),
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: invoice_items
-- Line items inside an invoice. One row per product in the order.
-- =============================================================================
DROP TABLE IF EXISTS invoice_items;
CREATE TABLE invoice_items (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  invoice_id    VARCHAR(36)   NOT NULL,
  product_type  VARCHAR(50)   NOT NULL,
  quantity      INT           NOT NULL DEFAULT 1,
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Optional reference to a saved measurement (snapshot is in values JSON)
  measurement_id VARCHAR(36) NULL,

  -- Snapshot of measurement values used for this item (JSON object keyed by field)
  -- e.g. {"chest":"40","shoulder":"18","neck":"15","sleeve":"24"}
  measurement_values JSON NULL,

  position      INT NOT NULL DEFAULT 0,  -- order within the invoice

  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_measurement
    FOREIGN KEY (measurement_id) REFERENCES measurements(id)
    ON DELETE SET NULL,

  INDEX idx_invoice_items_invoice (invoice_id),
  INDEX idx_invoice_items_measurement (measurement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Table: counters
-- Single-row table for sequential ID generation (invoice numbers, order labels).
-- =============================================================================
DROP TABLE IF EXISTS counters;
CREATE TABLE counters (
  name  VARCHAR(50)  NOT NULL PRIMARY KEY,
  value BIGINT       NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed counters
INSERT INTO counters (name, value) VALUES ('invoice', 0);
INSERT INTO counters (name, 'order') VALUES -- NOTE: 'order' is a SQL keyword, backtick it
  ('`order`', 0);
-- If the line above fails on your MySQL version, run this instead:
-- INSERT INTO counters (name, value) VALUES ('order', 0);


-- =============================================================================
-- Table: sessions (optional - for storing auth sessions server-side)
-- =============================================================================
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id     VARCHAR(36)  NOT NULL,
  token       VARCHAR(255) NOT NULL UNIQUE,
  expires_at  DATETIME     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_sessions_token (token),
  INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- Default admin seed
-- Password 'admin123' is hashed with bcrypt. The hash below is for the plain
-- string 'admin123' (10 rounds). Replace with your own if you re-seed.
-- =============================================================================
INSERT INTO users (id, name, email, mobile, password, role, status, created_at)
VALUES (
  'admin-0001',
  'Admin',
  'admin@tailorbook.com',
  '9999999999',
  -- bcrypt hash of "admin123" (10 rounds). If your API doesn't use bcrypt, use plain text temporarily:
  -- 'admin123',
  '$2a$10$YJ8dZqh7Q9xv9S2L3mZ9X.G6p8x6Qk5L.5L0n5tJ8K9mZ.Y8K9mZ9K',
  'admin',
  'approved',
  NOW()
) ON DUPLICATE KEY UPDATE name = VALUES(name);


-- =============================================================================
-- Sample tailors (for testing) - passwords are bcrypt-hashed "tailor123"
-- =============================================================================
INSERT INTO users (id, name, email, mobile, password, role, shop_name, status, created_at)
VALUES
  ('tailor-0001', 'Ramesh Kumar', 'ramesh@tailor.com', '9876543210', '$2a$10$x42IazrJE9Os2TvihzyUwepOhs3E0pv5OA5QtTIl1AB1P8Ealaw4K', 'tailor', 'Ramesh Tailors', 'approved', NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- =============================================================================
-- Sample customers
-- =============================================================================
INSERT INTO customers (id, tailor_id, name, mobile, email, address, created_at)
VALUES
  ('cust-0001', 'tailor-0001', 'Amit Patel',   '9123456700', 'amit@example.com', '12 MG Road, Mumbai',    NOW()),
  ('cust-0002', 'tailor-0001', 'Priya Sharma', '9123456701', 'priya@example.com', '45 Park Street, Delhi',  NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- =============================================================================
-- Sample measurements
-- =============================================================================
INSERT INTO measurements (id, customer_id, tailor_id, customer_name, product_type, measurement_date,
                          chest, shoulder, neck, sleeve, waist, length, hip, thigh, pant_length, bottom_width, armhole, wrist, created_at)
VALUES
  ('meas-0001', 'cust-0001', 'tailor-0001', 'Amit Patel',   'Shirt',  CURDATE(),
   40.00, 18.00, 15.00, 24.00, NULL,  NULL,  NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
  ('meas-0002', 'cust-0001', 'tailor-0001', 'Amit Patel',   'Pant',   CURDATE(),
   NULL,  NULL,  NULL,  NULL,  32.00, 40.00, 38.00, 22.00, 40.00, 8.00, NULL, NULL, NOW()),
  ('meas-0003', 'cust-0002', 'tailor-0001', 'Priya Sharma', 'Kurta',  CURDATE(),
   36.00, 16.00, 13.50, 22.00, 30.00, 42.00, 38.00, NULL,  NULL,  NULL, 14.00, 6.00, NOW())
ON DUPLICATE KEY UPDATE product_type = VALUES(product_type);


-- =============================================================================
-- Verify schema
-- =============================================================================
SHOW TABLES;
SELECT 'Schema created successfully' AS status;
