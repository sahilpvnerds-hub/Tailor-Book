-- =====================================================
-- COMPREHENSIVE DATABASE FIX FOR ORDER FLOW ISSUES
-- Run this migration to fix all order/measurement issues
-- =====================================================

-- 1. Fix orders.status enum to include 'partially-delivered'
-- Check if column exists and alter it
ALTER TABLE orders
MODIFY COLUMN status ENUM('pending', 'partially-delivered', 'completed', 'cancelled')
NOT NULL DEFAULT 'pending';

-- 2. Add delivery_status column to order_items if it doesn't exist
-- First check if column exists
SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'order_items'
  AND COLUMN_NAME = 'delivery_status'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE order_items ADD COLUMN delivery_status ENUM(''pending'', ''delivered'') NOT NULL DEFAULT ''pending''',
  'SELECT ''Column already exists''');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Create index for faster delivery status queries
CREATE INDEX idx_order_items_delivery_status ON order_items(delivery_status)
ON DUPLICATE KEY UPDATE delivery_status = delivery_status;

-- 4. Update existing completed orders' items to delivered status
UPDATE order_items oi
INNER JOIN orders o ON oi.order_id = o.id
SET oi.delivery_status = 'delivered'
WHERE o.status = 'completed' AND oi.delivery_status = 'pending';

-- 5. Verify all changes
SELECT '=== ORDERS STATUS VALUES ===' AS '';
SHOW COLUMNS FROM orders WHERE Field = 'status';

SELECT '=== ORDER_ITEMS DELIVERY STATUS ===' AS '';
SHOW COLUMNS FROM order_items WHERE Field = 'delivery_status';

SELECT '=== SAMPLE ORDER ITEMS ===' AS '';
SELECT oi.id, oi.delivery_status, o.status, o.order_number
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
LIMIT 5;