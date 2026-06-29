-- ===============================================================
-- MIGRATION: Fix Admin Orders List - Add delivery_status column
-- ===============================================================
-- RUN THIS SQL IN YOUR MYSQL DATABASE TO FIX THE 500 ERROR
-- ===============================================================

-- Step 1: Add delivery_status column to order_items
ALTER TABLE order_items
ADD COLUMN delivery_status ENUM('pending', 'delivered') NOT NULL DEFAULT 'pending'
AFTER invoice_id;

-- Step 2: Update existing completed orders to mark all items as delivered
UPDATE order_items oi
INNER JOIN orders o ON oi.order_id = o.id
SET oi.delivery_status = 'delivered'
WHERE o.status = 'completed' AND oi.delivery_status = 'pending';

-- Step 3: Add partially-delivered status to orders enum
ALTER TABLE orders
MODIFY COLUMN status ENUM('pending', 'partially-delivered', 'completed', 'cancelled')
NOT NULL DEFAULT 'pending';

-- Step 4: Update invoice status enum
ALTER TABLE invoices
MODIFY COLUMN status ENUM('pending', 'partially-delivered', 'completed', 'cancelled')
NOT NULL DEFAULT 'pending';

-- Step 5: Create index for faster delivery status queries
CREATE INDEX idx_order_items_delivery_status ON order_items(delivery_status);

-- Verify the changes
SELECT 'Migration completed!' as status;
SELECT COUNT(*) as total_orders FROM orders;
SELECT COUNT(*) as total_items FROM order_items;
SELECT COUNT(*) as delivered_items FROM order_items WHERE delivery_status = 'delivered';

-- ===============================================================
-- AFTER RUNNING THIS MIGRATION:
-- 1. Refresh the Admin Portal
-- 2. All orders should now appear in the Orders List
-- ===============================================================