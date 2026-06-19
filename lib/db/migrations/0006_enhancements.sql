-- 0006_enhancements.sql
-- Major enhancement pass: language preference, GPS coordinates, product
-- measurement unit, notification type extension, quantity default.
-- All changes are additive and backward-compatible with existing rows.

--> statement-breakpoint

-- 1. Users: preferred language + GPS coordinates
ALTER TABLE `users`
  ADD COLUMN `preferred_language` enum('en','hi','gu') NOT NULL DEFAULT 'en',
  ADD COLUMN `latitude` decimal(10,7) NULL,
  ADD COLUMN `longitude` decimal(10,7) NULL;

--> statement-breakpoint

-- 2. Customers: GPS coordinates (so customer search map / location
--    pinning works on the customer detail screen).
ALTER TABLE `customers`
  ADD COLUMN `latitude` decimal(10,7) NULL,
  ADD COLUMN `longitude` decimal(10,7) NULL;

--> statement-breakpoint

-- 3. Product types: measurement unit (inches vs centimetres)
ALTER TABLE `product_types`
  ADD COLUMN `unit` enum('inches','cm') NOT NULL DEFAULT 'inches';

--> statement-breakpoint

-- 4. Invoice items: tighten quantity default to 1
ALTER TABLE `invoice_items`
  MODIFY COLUMN `quantity` int NOT NULL DEFAULT 1;

--> statement-breakpoint

-- 5. Notifications: extend type enum to include 'whatsapp_due' so the
--    delivery dispatcher can mark a notification as having been handed
--    off to the WhatsApp deep-link.
ALTER TABLE `notifications`
  MODIFY COLUMN `type` enum(
    'delivery_due_today',
    'delivery_due_tomorrow',
    'delivery_overdue',
    'pending_invoice',
    'general',
    'whatsapp_due'
  ) NOT NULL;
