-- =============================================================================
-- Migration: Add features to product_types, feature_label to measurements
-- Run this on any existing database that was created before this migration.
-- =============================================================================

-- 1. Add unit column to product_types (if missing from older installs)
ALTER TABLE product_types
  ADD COLUMN IF NOT EXISTS unit ENUM('inches','cm') NOT NULL DEFAULT 'inches',
  ADD COLUMN IF NOT EXISTS features JSON NULL;

-- 2. Add feature_label to measurements
ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS feature_label VARCHAR(100) NULL AFTER product_type;

-- 3. Add feature_label to measurement_items
ALTER TABLE measurement_items
  ADD COLUMN IF NOT EXISTS feature_label VARCHAR(100) NULL AFTER product_type;

-- 4. Preserve the selected product master on order items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_type_id VARCHAR(36) NULL AFTER order_id,
  ADD INDEX IF NOT EXISTS idx_order_items_product_type (product_type_id);

-- 5. Preserve the selected product master on invoice items
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS product_type_id VARCHAR(36) NULL AFTER invoice_id,
  ADD INDEX IF NOT EXISTS idx_invoice_items_product_type (product_type_id);

SELECT 'Migration applied successfully' AS status;
