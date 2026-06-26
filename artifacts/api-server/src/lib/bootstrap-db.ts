import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { pool } from "@workspace/db";

interface DatabaseRow extends RowDataPacket {
  db: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

async function currentDatabase(): Promise<string> {
  const [rows] = await pool.query<DatabaseRow[]>("SELECT DATABASE() AS db");
  const db = rows[0]?.db;
  if (!db) throw new Error("No MySQL database selected");
  return db;
}

async function tableExists(database: string, table: string): Promise<boolean> {
  const [rows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = ? AND table_name = ?`,
    [database, table],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function columnExists(database: string, table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS count
       FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [database, table, column],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function indexExists(database: string, table: string, indexName: string): Promise<boolean> {
  const [rows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS count
       FROM information_schema.statistics
      WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [database, table, indexName],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function addColumnIfMissing(
  database: string,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  if (!(await columnExists(database, table, column))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

async function addIndexIfMissing(
  database: string,
  table: string,
  indexName: string,
  definition: string,
): Promise<void> {
  if (!(await indexExists(database, table, indexName))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` ${definition}`);
  }
}

async function dropColumnIfExists(database: string, table: string, column: string): Promise<void> {
  if (await columnExists(database, table, column)) {
    await pool.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  }
}

async function ensureColumns(database: string): Promise<void> {
  await addColumnIfMissing(database, "users", "speciality", "`speciality` varchar(200) NULL AFTER `role`");
  await addColumnIfMissing(database, "users", "email_verified_at", "`email_verified_at` timestamp NULL AFTER `status`");
  await addColumnIfMissing(database, "users", "onboarding_complete", "`onboarding_complete` boolean NOT NULL DEFAULT false AFTER `email_verified_at`");

  await addColumnIfMissing(database, "customers", "profile_picture", "`profile_picture` text NULL AFTER `notes`");
  await addColumnIfMissing(database, "customers", "gender", "`gender` enum('male','female','unisex') NOT NULL DEFAULT 'unisex' AFTER `mobile`");
  await addColumnIfMissing(database, "customers", "family_id", "`family_id` varchar(36) NULL AFTER `tailor_id`");
  await addIndexIfMissing(database, "customers", "customers_family_idx", "(`family_id`)");

  await addColumnIfMissing(database, "measurements", "delivery_date", "`delivery_date` date NULL AFTER `measurement_date`");
  await addColumnIfMissing(database, "measurements", "photos", "`photos` json DEFAULT ('[]') AFTER `notes`");
  await addColumnIfMissing(database, "measurements", "family_member_id", "`family_member_id` varchar(36) NULL AFTER `customer_id`");
  await addColumnIfMissing(database, "measurements", "measurement_session_id", "`measurement_session_id` varchar(36) NULL AFTER `family_member_id`");
  await addIndexIfMissing(database, "measurements", "idx_measurements_family_member", "(`family_member_id`)");
  await addIndexIfMissing(database, "measurements", "idx_measurements_session", "(`measurement_session_id`)");

  await addColumnIfMissing(database, "invoices", "delivery_date", "`delivery_date` date NULL AFTER `status`");
  await dropColumnIfExists(database, "invoices", "gst_rate");
  await dropColumnIfExists(database, "invoices", "gst_amount");

  await addColumnIfMissing(database, "invoice_items", "family_member_id", "`family_member_id` varchar(36) NULL AFTER `measurement_id`");
  await addColumnIfMissing(database, "invoice_items", "person_name", "`person_name` varchar(100) NULL AFTER `family_member_id`");
  await addColumnIfMissing(database, "invoice_items", "relation", "`relation` varchar(50) NULL AFTER `person_name`");
  await addColumnIfMissing(database, "invoice_items", "product_type_id", "`product_type_id` varchar(36) NULL AFTER `invoice_id`");
  await addColumnIfMissing(database, "invoice_items", "feature_label", "`feature_label` varchar(100) NULL AFTER `product_type`");
  await addIndexIfMissing(database, "invoice_items", "idx_invoice_items_product_type", "(`product_type_id`)");
  await addIndexIfMissing(database, "invoice_items", "idx_invoice_items_family_member", "(`family_member_id`)");

  await addColumnIfMissing(database, "order_items", "product_type_id", "`product_type_id` varchar(36) NULL AFTER `order_id`");
  await addIndexIfMissing(database, "order_items", "idx_order_items_product_type", "(`product_type_id`)");

  if (await tableExists(database, "custom_measurement_fields")) {
    await addColumnIfMissing(database, "custom_measurement_fields", "customer_id", "`customer_id` varchar(36) NULL AFTER `field_name`");
    await addColumnIfMissing(database, "custom_measurement_fields", "family_member_id", "`family_member_id` varchar(36) NULL AFTER `customer_id`");
    await addColumnIfMissing(database, "custom_measurement_fields", "product_type_id", "`product_type_id` varchar(36) NULL AFTER `family_member_id`");
    await addColumnIfMissing(database, "custom_measurement_fields", "product_type", "`product_type` varchar(100) NULL AFTER `product_type_id`");
    await addIndexIfMissing(database, "custom_measurement_fields", "idx_custom_fields_scope", "(`customer_id`, `family_member_id`, `product_type_id`)");
  }
}

async function ensureTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS family_members (
      id varchar(36) NOT NULL PRIMARY KEY,
      tailor_id varchar(36) NOT NULL,
      primary_customer_id varchar(36) NOT NULL,
      name varchar(100) NOT NULL,
      relation enum('father','mother','son','daughter','wife','husband','brother','sister','other') NOT NULL DEFAULT 'other',
      gender enum('male','female','unisex') NOT NULL DEFAULT 'unisex',
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX family_members_tailor_idx (tailor_id),
      INDEX family_members_primary_idx (primary_customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_types (
      id varchar(36) NOT NULL PRIMARY KEY,
      tailor_id varchar(36) NOT NULL,
      name varchar(100) NOT NULL,
      amount decimal(12,2) NOT NULL DEFAULT '0',
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX product_types_tailor_idx (tailor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS custom_measurement_fields (
      id varchar(36) NOT NULL PRIMARY KEY,
      tailor_id varchar(36) NOT NULL,
      field_name varchar(100) NOT NULL,
      customer_id varchar(36) NULL,
      family_member_id varchar(36) NULL,
      product_type_id varchar(36) NULL,
      product_type varchar(100) NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX custom_fields_tailor_idx (tailor_id),
      INDEX idx_custom_fields_scope (customer_id, family_member_id, product_type_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id varchar(36) NOT NULL PRIMARY KEY,
      tailor_id varchar(36) NOT NULL,
      title varchar(200) NOT NULL,
      message text NOT NULL,
      type enum('delivery_due_today','delivery_due_tomorrow','pending_invoice','general') NOT NULL DEFAULT 'general',
      related_id varchar(36),
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX notifications_tailor_idx (tailor_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_otps (
      id varchar(36) NOT NULL PRIMARY KEY,
      email varchar(150) NOT NULL,
      otp varchar(6) NOT NULL,
      expires_at timestamp NOT NULL,
      attempts int NOT NULL DEFAULT 0,
      consumed boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX pending_otps_email_idx (email, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS measurement_sessions (
      id varchar(36) NOT NULL PRIMARY KEY,
      customer_id varchar(36) NOT NULL,
      family_member_id varchar(36) NULL,
      tailor_id varchar(36) NOT NULL,
      measurement_date date NOT NULL,
      delivery_date date NULL,
      notes text NULL,
      photos json NULL DEFAULT ('[]'),
      created_by varchar(36) NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_measurement_sessions_customer (customer_id),
      INDEX idx_measurement_sessions_family_member (family_member_id),
      INDEX idx_measurement_sessions_tailor (tailor_id),
      INDEX idx_measurement_sessions_date (measurement_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS measurement_items (
      id varchar(36) NOT NULL PRIMARY KEY,
      measurement_session_id varchar(36) NOT NULL,
      product_type_id varchar(36) NULL,
      product_type varchar(100) NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_measurement_items_session (measurement_session_id),
      INDEX idx_measurement_items_product_type (product_type_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS measurement_values (
      id varchar(36) NOT NULL PRIMARY KEY,
      measurement_item_id varchar(36) NOT NULL,
      field_name varchar(100) NOT NULL,
      field_value decimal(8,2) NOT NULL,
      INDEX idx_measurement_values_item (measurement_item_id),
      INDEX idx_measurement_values_field (field_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Admin audit log — one row per admin-initiated mutation on a user
  // (approve / reject / suspend / unsuspend / patch / delete). Used for
  // compliance and dispute resolution.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id varchar(36) NOT NULL PRIMARY KEY,
      admin_id varchar(36) NOT NULL,
      action enum('approve','reject','suspend','unsuspend','patch','delete') NOT NULL,
      target_type enum('user') NOT NULL DEFAULT 'user',
      target_id varchar(36) NOT NULL,
      before_json json NULL,
      after_json json NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_admin (admin_id, created_at),
      INDEX idx_audit_target (target_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureDemoUsers(): Promise<void> {
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "admin123", 10);
  await pool.query(
    `INSERT INTO users (id, name, email, mobile, password, role, status, email_verified_at, onboarding_complete, created_at)
     VALUES ('admin-0001', 'Admin', 'admin@tailorbook.com', '9999999999', ?, 'admin', 'approved', NOW(), true, NOW())
     ON DUPLICATE KEY UPDATE role = 'admin', status = 'approved', email_verified_at = COALESCE(email_verified_at, NOW()), onboarding_complete = true`,
    [adminPassword],
  );

  const tailorPassword = await bcrypt.hash("tailor123", 10);
  await pool.query(
    `INSERT INTO users (id, name, email, mobile, password, role, shop_name, status, email_verified_at, onboarding_complete, created_at)
     VALUES ('tailor-0001', 'Ramesh Kumar', 'ramesh@tailor.com', '9876543210', ?, 'tailor', 'Ramesh Tailors', 'approved', NOW(), true, NOW())
     ON DUPLICATE KEY UPDATE role = 'tailor', status = 'approved', email_verified_at = COALESCE(email_verified_at, NOW())`,
    [tailorPassword],
  );
}

export async function bootstrapDatabase(): Promise<void> {
  const database = await currentDatabase();
  if (!(await tableExists(database, "users"))) {
    throw new Error("Tailor Book database is missing the users table. Import db/schema.sql first.");
  }

  await ensureColumns(database);
  await ensureTables();
  await ensureDemoUsers();
}
