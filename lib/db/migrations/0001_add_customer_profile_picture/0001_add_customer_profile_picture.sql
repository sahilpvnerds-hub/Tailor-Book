-- =============================================================================
-- Migration 0001: Add `profile_picture` column to `customers`
-- Generated for: tailorbook MySQL database
-- Safe: nullable column, no data loss. Existing rows get NULL.
-- Rollback:  ALTER TABLE `customers` DROP COLUMN `profile_picture`;
-- =============================================================================

USE tailorbook;

ALTER TABLE `customers`
  ADD COLUMN `profile_picture` TEXT NULL AFTER `notes`;
