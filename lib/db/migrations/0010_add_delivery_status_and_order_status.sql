-- Migration: Add delivery_status to order_items and update order status enum
-- Run this on your MySQL database to fix the order/invoice flow

-- 1. Add delivery_status column to order_items table
ALTER TABLE order_items
ADD COLUMN delivery_status ENUM('pending', 'delivered') NOT NULL DEFAULT 'pending';

-- 2. Update existing completed orders to mark all items as delivered
UPDATE order_items oi
INNER JOIN orders o ON oi.order_id = o.id
SET oi.delivery_status = 'delivered'
WHERE o.status = 'completed' AND oi.delivery_status = 'pending';

-- 3. Note: MySQL doesn't support adding values to ENUM easily in older versions
-- If the orders.status column already exists and is an enum, you'll need to alter it
-- For MySQL 8.0+, you can do:
ALTER TABLE orders
MODIFY COLUMN status ENUM('pending', 'partially-delivered', 'completed', 'cancelled')
NOT NULL DEFAULT 'pending';

-- 4. Create index for faster delivery status queries
CREATE INDEX idx_order_items_delivery_status ON order_items(delivery_status);