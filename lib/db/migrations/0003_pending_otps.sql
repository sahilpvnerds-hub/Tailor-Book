-- Email OTP table for the registration flow
-- Stores short-lived OTPs (10 min TTL by default) keyed by email, with an
-- attempt counter and a consumed flag so a single OTP can only be used once.

--> statement-breakpoint

CREATE TABLE `pending_otps` (
  `id` varchar(36) NOT NULL,
  `email` varchar(150) NOT NULL,
  `otp` varchar(6) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `attempts` int NOT NULL DEFAULT 0,
  `consumed` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `pending_otps_id` PRIMARY KEY(`id`),
  INDEX `pending_otps_email_idx` (`email`, `created_at`)
);
