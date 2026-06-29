#!/bin/bash

echo "Running Tailor Book Database Migrations..."
echo "================================================"
echo ""

MYSQL_HOST=${MYSQL_HOST:-localhost}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-admin123}
MYSQL_DATABASE=${MYSQL_DATABASE:-tailorbook}

echo "Connecting to MySQL at $MYSQL_HOST:$MYSQL_PORT..."
echo ""

# Run migration 0010
echo "Running migration 0010: Add delivery status to order items"
mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE <<EOF
-- Add delivery_status column to order_items table
ALTER TABLE order_items
ADD COLUMN delivery_status ENUM('pending', 'delivered') NOT NULL DEFAULT 'pending'
AFTER invoice_id;

-- Update existing completed orders to mark all items as delivered
UPDATE order_items oi
INNER JOIN orders o ON oi.order_id = o.id
SET oi.delivery_status = 'delivered'
WHERE o.status = 'completed' AND oi.delivery_status = 'pending';

-- Add partially-delivered status to orders enum
ALTER TABLE orders
MODIFY COLUMN status ENUM('pending', 'partially-delivered', 'completed', 'cancelled')
NOT NULL DEFAULT 'pending';

-- Update invoice status too
ALTER TABLE invoices
MODIFY COLUMN status ENUM('pending', 'partially-delivered', 'completed', 'cancelled')
NOT NULL DEFAULT 'pending';

-- Create index for faster delivery status queries
CREATE INDEX idx_order_items_delivery_status ON order_items(delivery_status);

SELECT 'Migration 0010 completed successfully!' as status;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo "Run 'npm run dev' to start the API server."
else
    echo ""
    echo "❌ Migration failed. Please check your MySQL connection settings."
    exit 1
fi