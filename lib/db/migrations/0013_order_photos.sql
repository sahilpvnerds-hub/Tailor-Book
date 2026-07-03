-- =============================================================================
-- Migration: Add photos column to orders table
-- Stores order-level reference photos (base64-encoded strings)
-- =============================================================================
ALTER TABLE orders ADD COLUMN photos JSON NULL DEFAULT ('[]');
