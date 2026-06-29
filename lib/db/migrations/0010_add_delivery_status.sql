-- =============================================================================
-- Migration: Add delivery status to order items and update order status enum
-- =============================================================================
-- This migration adds the delivery_status column to order_items table
-- to support per-item delivery tracking, and adds partially-delivered to orders.
-- =============================================================================

-- 1. Add delivery_status column to order_items table
ALTER TABLE order_items
ADD COLUMN delivery_status ENUM('pending', 'delivered') NOT NULL DEFAULT 'pending'
AFTER invoice_id;

-- 2. Update existing completed orders to mark all items as delivered
UPDATE order_items oi
INNER JOIN orders o ON oi.order_id = o.id
SET oi.delivery_status = 'delivered'
WHERE o.status = 'completed' AND oi.delivery_status = 'pending';

-- 3. Add partially-delivered status to orders enum
ALTER TABLE orders
MODIFY COLUMN status ENUM('pending', 'partially-delivered', 'completed', 'cancelled')
NOT NULL DEFAULT 'pending';

-- 4. Create index for faster delivery status queries
CREATE INDEX idx_order_items_delivery_status ON order_items(delivery_status);
