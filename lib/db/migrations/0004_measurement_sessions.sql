ALTER TABLE measurements
  ADD COLUMN family_member_id VARCHAR(36) NULL AFTER customer_id,
  ADD COLUMN measurement_session_id VARCHAR(36) NULL AFTER family_member_id,
  ADD INDEX idx_measurements_family_member (family_member_id),
  ADD INDEX idx_measurements_session (measurement_session_id);

CREATE TABLE IF NOT EXISTS measurement_sessions (
  id                  VARCHAR(36) NOT NULL PRIMARY KEY,
  customer_id          VARCHAR(36) NOT NULL,
  family_member_id     VARCHAR(36) NULL,
  tailor_id            VARCHAR(36) NOT NULL,
  measurement_date     DATE NOT NULL,
  delivery_date        DATE NULL,
  notes                TEXT NULL,
  photos               JSON NULL DEFAULT ('[]'),
  created_by           VARCHAR(36) NOT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_measurement_sessions_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_measurement_sessions_family_member
    FOREIGN KEY (family_member_id) REFERENCES family_members(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_measurement_sessions_tailor
    FOREIGN KEY (tailor_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_measurement_sessions_customer (customer_id),
  INDEX idx_measurement_sessions_family_member (family_member_id),
  INDEX idx_measurement_sessions_tailor (tailor_id),
  INDEX idx_measurement_sessions_date (measurement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS measurement_items (
  id                      VARCHAR(36) NOT NULL PRIMARY KEY,
  measurement_session_id  VARCHAR(36) NOT NULL,
  product_type_id         VARCHAR(36) NULL,
  product_type            VARCHAR(100) NOT NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_measurement_items_session
    FOREIGN KEY (measurement_session_id) REFERENCES measurement_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_measurement_items_product_type
    FOREIGN KEY (product_type_id) REFERENCES product_types(id)
    ON DELETE SET NULL,

  INDEX idx_measurement_items_session (measurement_session_id),
  INDEX idx_measurement_items_product_type (product_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS measurement_values (
  id                   VARCHAR(36) NOT NULL PRIMARY KEY,
  measurement_item_id  VARCHAR(36) NOT NULL,
  field_name           VARCHAR(100) NOT NULL,
  field_value          DECIMAL(8,2) NOT NULL,

  CONSTRAINT fk_measurement_values_item
    FOREIGN KEY (measurement_item_id) REFERENCES measurement_items(id)
    ON DELETE CASCADE,

  INDEX idx_measurement_values_item (measurement_item_id),
  INDEX idx_measurement_values_field (field_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
