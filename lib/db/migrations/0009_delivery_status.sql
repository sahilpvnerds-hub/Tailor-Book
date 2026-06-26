-- Add deliveryStatus field to order_items table
-- Also update order_items table to delivery_status column
ALTER TABLE order_items
ADD COLUMN delivery_status ENUM('pending', 'delivered') NOT NULL DEFAULT 'pending';

-- Update existing orders with completed status to mark all items as delivered
UPDATE order_items
SET delivery_status = 'delivered'
WHERE delivery_status = 'pending' AND EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.orderId
    AND orders.status = 'completed'
);

-- Add index for better performance
ALTER TABLE order_items ADD INDEX idx_delivery_status (delivery_status);
ALTER TABLE order_items ADD INDEX idx_order_delivery_status (orderId, delivery_status);