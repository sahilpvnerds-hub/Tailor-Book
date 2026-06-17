CREATE TABLE `counters` (
	`name` varchar(50) NOT NULL,
	`value` int NOT NULL DEFAULT 0,
	CONSTRAINT `counters_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `custom_measurement_fields` (
	`id` varchar(36) NOT NULL,
	`tailor_id` varchar(36) NOT NULL,
	`field_name` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_measurement_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` varchar(36) NOT NULL,
	`tailor_id` varchar(36) NOT NULL,
	`family_id` varchar(36),
	`name` varchar(100) NOT NULL,
	`mobile` varchar(20) NOT NULL,
	`gender` enum('male','female','unisex') NOT NULL DEFAULT 'unisex',
	`email` varchar(150),
	`address` text,
	`notes` text,
	`profile_picture` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` varchar(36) NOT NULL,
	`tailor_id` varchar(36) NOT NULL,
	`primary_customer_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`relation` enum('father','mother','son','daughter','wife','husband','brother','sister','other') NOT NULL DEFAULT 'other',
	`gender` enum('male','female','unisex') NOT NULL DEFAULT 'unisex',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` varchar(36) NOT NULL,
	`invoice_id` varchar(36) NOT NULL,
	`product_type` varchar(50) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`price` decimal(12,2) NOT NULL DEFAULT '0',
	`measurement_id` varchar(36),
	`measurement_values` json,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` varchar(36) NOT NULL,
	`invoice_number` varchar(20) NOT NULL,
	`order_label` varchar(20) NOT NULL,
	`tailor_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`customer_name` varchar(100) NOT NULL,
	`customer_mobile` varchar(20) NOT NULL,
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
	`delivery_date` date,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoice_number_unique` UNIQUE(`invoice_number`),
	CONSTRAINT `invoices_order_label_unique` UNIQUE(`order_label`)
);
--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`tailor_id` varchar(36) NOT NULL,
	`customer_name` varchar(100) NOT NULL,
	`product_type` varchar(50) NOT NULL,
	`measurement_date` date NOT NULL,
	`delivery_date` date,
	`chest` decimal(6,2),
	`shoulder` decimal(6,2),
	`neck` decimal(6,2),
	`sleeve` decimal(6,2),
	`waist` decimal(6,2),
	`length` decimal(6,2),
	`hip` decimal(6,2),
	`thigh` decimal(6,2),
	`pant_length` decimal(6,2),
	`bottom_width` decimal(6,2),
	`armhole` decimal(6,2),
	`wrist` decimal(6,2),
	`custom_measurements` json DEFAULT ('[]'),
	`notes` text,
	`photos` json DEFAULT ('[]'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`tailor_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`type` enum('delivery_due_today','delivery_due_tomorrow','pending_invoice','general') NOT NULL DEFAULT 'general',
	`related_id` varchar(36),
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_types` (
	`id` varchar(36) NOT NULL,
	`tailor_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(150) NOT NULL,
	`mobile` varchar(20) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('admin','tailor') NOT NULL DEFAULT 'tailor',
	`speciality` enum('male','female','unisex'),
	`shop_name` varchar(150),
	`shop_address` varchar(255),
	`city` varchar(100),
	`state` varchar(100),
	`avatar_uri` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`email_verified_at` timestamp,
	`onboarding_complete` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_mobile_unique` UNIQUE(`mobile`)
);
