-- =============================================================================
-- Migration: Add orders and order_items tables, link invoices to orders
-- =============================================================================

USE tailorbook;

-- 1. Create orders table
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
  advance_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_due      DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_orders_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT,

  INDEX idx_orders_tailor   (tailor_id),
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_status   (status),
  INDEX idx_orders_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
  order_id           VARCHAR(36)   NOT NULL,
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

  INDEX idx_order_items_order         (order_id),
  INDEX idx_order_items_family_member (family_member_id),
  INDEX idx_order_items_measurement   (measurement_id),
  INDEX idx_order_items_invoice       (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Add order_id to invoices
ALTER TABLE invoices
  ADD COLUMN order_id VARCHAR(36) NULL AFTER order_label;

-- 4. Add index to invoices.order_id
ALTER TABLE invoices
  ADD INDEX idx_invoices_order (order_id);

-- 5. Add advance_amount and balance_due to orders (in case table already existed without them)
ALTER TABLE orders
  ADD COLUMN advance_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_amount;

ALTER TABLE orders
  ADD COLUMN balance_due DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER advance_amount;

-- 6. Add paid_amount to invoices (tracks advance carried over from order)
ALTER TABLE invoices
  ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total;

SELECT 'Orders migration applied successfully' AS status;
