-- 0007_admin_audit.sql
-- Adds the admin_audit_log table for compliance and dispute resolution.
-- One row per admin-initiated mutation (approve/reject/suspend/unsuspend/
-- patch/delete on a user). Lightweight: stores IDs and JSON snapshots.

--> statement-breakpoint

CREATE TABLE `admin_audit_log` (
  `id` varchar(36) NOT NULL,
  `admin_id` varchar(36) NOT NULL,
  `action` enum('approve','reject','suspend','unsuspend','patch','delete') NOT NULL,
  `target_type` enum('user') NOT NULL DEFAULT 'user',
  `target_id` varchar(36) NOT NULL,
  `before_json` json NULL,
  `after_json` json NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `admin_audit_log_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint

CREATE INDEX `idx_audit_admin` ON `admin_audit_log` (`admin_id`, `created_at`);
CREATE INDEX `idx_audit_target` ON `admin_audit_log` (`target_id`, `created_at`);