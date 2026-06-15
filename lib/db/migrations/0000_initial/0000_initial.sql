-- =============================================================================
-- Migration 0000: Initial schema
-- Generated for: tailorbook MySQL database
-- Connection:    localhost:3306, user: root, password: admin123
-- =============================================================================

-- Create the database
CREATE DATABASE IF NOT EXISTS tailorbook
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tailorbook;

-- -----------------------------------------------------------------------------
-- Table: users
-- -----------------------------------------------------------------------------
CREATE TABLE `users` (
  `id`         VARCHAR(36)  NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `email`      VARCHAR(150) NOT NULL,
  `mobile`     VARCHAR(20)  NOT NULL,
  `password`   VARCHAR(255) NOT NULL,
  `role`       ENUM('admin','tailor') NOT NULL DEFAULT 'tailor',
  `shop_name`  VARCHAR(150),
  `shop_address` VARCHAR(255),
  `city`       VARCHAR(100),
  `state`      VARCHAR(100),
  `avatar_uri` TEXT,
  `status`     ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_mobile_unique` (`mobile`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_mobile` (`mobile`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- Table: customers
-- -----------------------------------------------------------------------------
CREATE TABLE `customers` (
  `id`         VARCHAR(36)  NOT NULL,
  `tailor_id`  VARCHAR(36)  NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `mobile`     VARCHAR(20)  NOT NULL,
  `email`      VARCHAR(150),
  `address`    TEXT,
  `notes`      TEXT,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_tailor` (`tailor_id`),
  KEY `idx_customers_mobile` (`mobile`),
  KEY `idx_customers_name` (`name`),
  CONSTRAINT `fk_customers_tailor`
    FOREIGN KEY (`tailor_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- Table: measurements
-- -----------------------------------------------------------------------------
CREATE TABLE `measurements` (
  `id`                VARCHAR(36)  NOT NULL,
  `customer_id`       VARCHAR(36)  NOT NULL,
  `tailor_id`         VARCHAR(36)  NOT NULL,
  `customer_name`     VARCHAR(100) NOT NULL,
  `product_type`      VARCHAR(50)  NOT NULL,
  `measurement_date`  DATE         NOT NULL,
  `chest`             DECIMAL(6,2),
  `shoulder`          DECIMAL(6,2),
  `neck`              DECIMAL(6,2),
  `sleeve`            DECIMAL(6,2),
  `waist`             DECIMAL(6,2),
  `length`            DECIMAL(6,2),
  `hip`               DECIMAL(6,2),
  `thigh`             DECIMAL(6,2),
  `pant_length`       DECIMAL(6,2),
  `bottom_width`      DECIMAL(6,2),
  `armhole`           DECIMAL(6,2),
  `wrist`             DECIMAL(6,2),
  `custom_measurements` JSON,
  `notes`             TEXT,
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_measurements_customer` (`customer_id`),
  KEY `idx_measurements_tailor` (`tailor_id`),
  KEY `idx_measurements_product` (`customer_id`, `product_type`),
  KEY `idx_measurements_date` (`measurement_date`),
  CONSTRAINT `fk_measurements_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_measurements_tailor`
    FOREIGN KEY (`tailor_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- Table: invoices
-- -----------------------------------------------------------------------------
CREATE TABLE `invoices` (
  `id`               VARCHAR(36)   NOT NULL,
  `invoice_number`   VARCHAR(20)   NOT NULL,
  `order_label`      VARCHAR(20)   NOT NULL,
  `tailor_id`        VARCHAR(36)   NOT NULL,
  `customer_id`      VARCHAR(36)   NOT NULL,
  `customer_name`    VARCHAR(100)  NOT NULL,
  `customer_mobile`  VARCHAR(20)   NOT NULL,
  `subtotal`         DECIMAL(12,2) NOT NULL DEFAULT 0,
  `gst_rate`         DECIMAL(5,2)  NOT NULL DEFAULT 0,
  `gst_amount`       DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total`            DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status`           ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  `notes`            TEXT,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_number_unique` (`invoice_number`),
  UNIQUE KEY `invoices_label_unique` (`order_label`),
  KEY `idx_invoices_tailor` (`tailor_id`),
  KEY `idx_invoices_customer` (`customer_id`),
  KEY `idx_invoices_status` (`status`),
  KEY `idx_invoices_created` (`created_at`),
  CONSTRAINT `fk_invoices_tailor`
    FOREIGN KEY (`tailor_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_invoices_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- Table: invoice_items
-- -----------------------------------------------------------------------------
CREATE TABLE `invoice_items` (
  `id`                 VARCHAR(36)   NOT NULL,
  `invoice_id`         VARCHAR(36)   NOT NULL,
  `product_type`       VARCHAR(50)   NOT NULL,
  `quantity`           INT           NOT NULL DEFAULT 1,
  `price`              DECIMAL(12,2) NOT NULL DEFAULT 0,
  `measurement_id`     VARCHAR(36),
  `measurement_values` JSON,
  `position`           INT           NOT NULL DEFAULT 0,
  `created_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_items_invoice` (`invoice_id`),
  KEY `idx_invoice_items_measurement` (`measurement_id`),
  CONSTRAINT `fk_invoice_items_invoice`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_items_measurement`
    FOREIGN KEY (`measurement_id`) REFERENCES `measurements`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- Table: counters (for sequential invoice/order numbers)
-- -----------------------------------------------------------------------------
CREATE TABLE `counters` (
  `name`  VARCHAR(50) NOT NULL,
  `value` INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- Table: sessions (optional, for server-side session storage)
-- -----------------------------------------------------------------------------
CREATE TABLE `sessions` (
  `id`         VARCHAR(64)  NOT NULL,
  `user_id`    VARCHAR(36)  NOT NULL,
  `token`      VARCHAR(255) NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessions_token_unique` (`token`),
  KEY `idx_sessions_token` (`token`),
  KEY `idx_sessions_user` (`user_id`),
  CONSTRAINT `fk_sessions_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- Seed: counters
-- -----------------------------------------------------------------------------
INSERT INTO `counters` (`name`, `value`) VALUES
  ('invoice', 0),
  ('order', 0);


-- -----------------------------------------------------------------------------
-- Seed: default admin user
-- Password: admin123 (bcrypt hash — DO NOT change without regenerating)
-- -----------------------------------------------------------------------------
INSERT INTO `users` (`id`, `name`, `email`, `mobile`, `password`, `role`, `status`, `created_at`)
VALUES (
  'admin-0001',
  'Admin',
  'admin@tailorbook.com',
  '9999999999',
  '$2a$10$Zfmv.Mqy/XK1KzQnQTTFZeZV1UQHkexbVYRKhUcjQtuDBvxWW.LIa',
  'admin',
  'approved',
  NOW()
);


-- -----------------------------------------------------------------------------
-- Seed: sample tailors
-- Password: tailor123 (bcrypt hash)
-- -----------------------------------------------------------------------------
INSERT INTO `users` (`id`, `name`, `email`, `mobile`, `password`, `role`, `shop_name`, `status`, `created_at`)
VALUES
  ('tailor-0001', 'Ramesh Kumar', 'ramesh@tailor.com', '9876543210', '$2a$10$x42IazrJE9Os2TvihzyUwepOhs3E0pv5OA5QtTIl1AB1P8Ealaw4K', 'tailor', 'Ramesh Tailors',     'approved', NOW());


-- -----------------------------------------------------------------------------
-- Seed: sample customers
-- -----------------------------------------------------------------------------
INSERT INTO `customers` (`id`, `tailor_id`, `name`, `mobile`, `email`, `address`, `created_at`)
VALUES
  ('cust-0001', 'tailor-0001', 'Amit Patel',   '9123456700', 'amit@example.com',  '12 MG Road, Mumbai',   NOW()),
  ('cust-0002', 'tailor-0001', 'Priya Sharma', '9123456701', 'priya@example.com', '45 Park Street, Delhi', NOW()),
  ('cust-0003', 'tailor-0002', 'Rahul Verma',  '9123456702', NULL,                 '78 Lake View, Pune',   NOW());


-- -----------------------------------------------------------------------------
-- Seed: sample measurements
-- -----------------------------------------------------------------------------
INSERT INTO `measurements` (
  `id`, `customer_id`, `tailor_id`, `customer_name`, `product_type`, `measurement_date`,
  `chest`, `shoulder`, `neck`, `sleeve`,
  `waist`, `length`, `hip`, `thigh`, `pant_length`, `bottom_width`,
  `armhole`, `wrist`, `created_at`
)
VALUES
  ('meas-0001', 'cust-0001', 'tailor-0001', 'Amit Patel',   'Shirt',  CURDATE(),
   40.00, 18.00, 15.00, 24.00,
   NULL,  NULL,  NULL,  NULL,  NULL,  NULL,
   NULL,  NULL,  NOW()),
  ('meas-0002', 'cust-0001', 'tailor-0001', 'Amit Patel',   'Pant',   CURDATE(),
   NULL,  NULL,  NULL,  NULL,
   32.00, 40.00, 38.00, 22.00, 40.00, 8.00,
   NULL,  NULL,  NOW()),
  ('meas-0003', 'cust-0002', 'tailor-0001', 'Priya Sharma', 'Kurta',  CURDATE(),
   36.00, 16.00, 13.50, 22.00,
   30.00, 42.00, 38.00, NULL,  NULL,  NULL,
   14.00, 6.00,  NOW());
