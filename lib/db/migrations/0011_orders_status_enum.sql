-- Migration: Update orders status enum to include 'partially-delivered'
-- This fixes the order creation API error

-- MySQL doesn't allow adding values to ENUM directly in older versions
-- For MySQL 8.0+, you can use this syntax:

ALTER TABLE orders
MODIFY COLUMN status ENUM('pending', 'partially-delivered', 'completed', 'cancelled')
NOT NULL DEFAULT 'pending';

-- Verify the change
DESCRIBE orders;
