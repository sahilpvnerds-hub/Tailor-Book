-- Tailor Book v2 features
-- 1. Add fields to existing tables: users, customers, measurements, invoices
-- 2. Create new tables: family_members, product_types, custom_measurement_fields, notifications
-- 3. Drop GST columns from invoices (per user request)

--> statement-breakpoint

-- users: add speciality (free text), email_verified_at, onboarding_complete
ALTER TABLE `users`
  ADD COLUMN `speciality` varchar(200) NULL AFTER `role`,
  ADD COLUMN `email_verified_at` timestamp NULL AFTER `status`,
  ADD COLUMN `onboarding_complete` boolean NOT NULL DEFAULT false AFTER `email_verified_at`;

--> statement-breakpoint

-- customers: add gender (required) + family_id
ALTER TABLE `customers`
  ADD COLUMN `gender` enum('male','female','unisex') NOT NULL DEFAULT 'unisex' AFTER `mobile`,
  ADD COLUMN `family_id` varchar(36) NULL AFTER `tailor_id`,
  ADD INDEX `customers_family_idx` (`family_id`);

--> statement-breakpoint

-- measurements: add delivery_date + photos
ALTER TABLE `measurements`
  ADD COLUMN `delivery_date` date NULL AFTER `measurement_date`,
  ADD COLUMN `photos` json DEFAULT ('[]') AFTER `notes`;

--> statement-breakpoint

-- invoices: add delivery_date, drop GST columns
ALTER TABLE `invoices`
  ADD COLUMN `delivery_date` date NULL AFTER `status`,
  DROP COLUMN `gst_rate`,
  DROP COLUMN `gst_amount`;

--> statement-breakpoint

-- family_members: new
CREATE TABLE `family_members` (
  `id` varchar(36) NOT NULL,
  `tailor_id` varchar(36) NOT NULL,
  `primary_customer_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `relation` enum('father','mother','son','daughter','wife','husband','brother','sister','other') NOT NULL DEFAULT 'other',
  `gender` enum('male','female','unisex') NOT NULL DEFAULT 'unisex',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `family_members_id` PRIMARY KEY(`id`),
  INDEX `family_members_tailor_idx` (`tailor_id`),
  INDEX `family_members_primary_idx` (`primary_customer_id`)
);

--> statement-breakpoint

-- product_types: new
CREATE TABLE `product_types` (
  `id` varchar(36) NOT NULL,
  `tailor_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `product_types_id` PRIMARY KEY(`id`),
  INDEX `product_types_tailor_idx` (`tailor_id`)
);

--> statement-breakpoint

-- custom_measurement_fields: new
CREATE TABLE `custom_measurement_fields` (
  `id` varchar(36) NOT NULL,
  `tailor_id` varchar(36) NOT NULL,
  `field_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `custom_measurement_fields_id` PRIMARY KEY(`id`),
  INDEX `custom_fields_tailor_idx` (`tailor_id`)
);

--> statement-breakpoint

-- notifications: new
CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL,
  `tailor_id` varchar(36) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `type` enum('delivery_due_today','delivery_due_tomorrow','pending_invoice','general') NOT NULL DEFAULT 'general',
  `related_id` varchar(36),
  `is_read` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
  INDEX `notifications_tailor_idx` (`tailor_id`, `created_at`)
);
