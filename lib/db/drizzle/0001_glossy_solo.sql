CREATE TABLE `admin_audit_log` (
	`id` varchar(36) NOT NULL,
	`admin_id` varchar(36) NOT NULL,
	`action` enum('approve','reject','suspend','unsuspend','patch','delete') NOT NULL,
	`target_type` enum('user') NOT NULL DEFAULT 'user',
	`target_id` varchar(36) NOT NULL,
	`before_json` json,
	`after_json` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurement_items` (
	`id` varchar(36) NOT NULL,
	`measurement_session_id` varchar(36) NOT NULL,
	`product_type_id` varchar(36),
	`product_type` varchar(100) NOT NULL,
	`feature_label` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `measurement_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurement_sessions` (
	`id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`family_member_id` varchar(36),
	`tailor_id` varchar(36) NOT NULL,
	`measurement_date` date NOT NULL,
	`delivery_date` date,
	`notes` text,
	`photos` json DEFAULT ('[]'),
	`created_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `measurement_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurement_values` (
	`id` varchar(36) NOT NULL,
	`measurement_item_id` varchar(36) NOT NULL,
	`field_name` varchar(100) NOT NULL,
	`field_value` decimal(8,2) NOT NULL,
	CONSTRAINT `measurement_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`product_type_id` varchar(36),
	`product_type` varchar(50) NOT NULL,
	`feature_label` varchar(100),
	`quantity` int NOT NULL DEFAULT 1,
	`price` decimal(12,2) NOT NULL DEFAULT '0',
	`measurement_id` varchar(36),
	`family_member_id` varchar(36),
	`person_name` varchar(100),
	`relation` varchar(50),
	`measurement_values` json,
	`invoice_id` varchar(36),
	`delivery_status` enum('pending','delivered') DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`order_number` varchar(20) NOT NULL,
	`tailor_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`customer_name` varchar(100) NOT NULL,
	`customer_mobile` varchar(20) NOT NULL,
	`status` enum('pending','partially-delivered','completed','cancelled') NOT NULL DEFAULT 'pending',
	`delivery_date` date,
	`notes` text,
	`total_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`advance_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`balance_due` decimal(12,2) NOT NULL DEFAULT '0',
	`photos` json DEFAULT ('[]'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `pending_otps` (
	`id` varchar(36) NOT NULL,
	`email` varchar(150) NOT NULL,
	`otp` varchar(6) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`consumed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pending_otps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `status` enum('pending','partially-delivered','completed','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('delivery_due_today','delivery_due_tomorrow','delivery_overdue','pending_invoice','general','whatsapp_due') NOT NULL DEFAULT 'general';--> statement-breakpoint
ALTER TABLE `custom_measurement_fields` ADD `customer_id` varchar(36);--> statement-breakpoint
ALTER TABLE `custom_measurement_fields` ADD `family_member_id` varchar(36);--> statement-breakpoint
ALTER TABLE `custom_measurement_fields` ADD `product_type_id` varchar(36);--> statement-breakpoint
ALTER TABLE `custom_measurement_fields` ADD `product_type` varchar(100);--> statement-breakpoint
ALTER TABLE `customers` ADD `latitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `customers` ADD `longitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `product_type_id` varchar(36);--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `feature_label` varchar(100);--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `family_member_id` varchar(36);--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `person_name` varchar(100);--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `relation` varchar(50);--> statement-breakpoint
ALTER TABLE `invoices` ADD `order_id` varchar(36);--> statement-breakpoint
ALTER TABLE `invoices` ADD `paid_amount` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `measurements` ADD `family_member_id` varchar(36);--> statement-breakpoint
ALTER TABLE `measurements` ADD `measurement_session_id` varchar(36);--> statement-breakpoint
ALTER TABLE `measurements` ADD `feature_label` varchar(100);--> statement-breakpoint
ALTER TABLE `product_types` ADD `unit` enum('inches','cm') DEFAULT 'inches' NOT NULL;--> statement-breakpoint
ALTER TABLE `product_types` ADD `features` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_language` enum('en','hi','gu') DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `latitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `users` ADD `longitude` decimal(10,7);