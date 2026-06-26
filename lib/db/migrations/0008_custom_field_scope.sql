ALTER TABLE custom_measurement_fields
  ADD COLUMN customer_id VARCHAR(36) NULL AFTER field_name,
  ADD COLUMN family_member_id VARCHAR(36) NULL AFTER customer_id,
  ADD COLUMN product_type_id VARCHAR(36) NULL AFTER family_member_id,
  ADD COLUMN product_type VARCHAR(100) NULL AFTER product_type_id,
  ADD INDEX idx_custom_fields_scope (customer_id, family_member_id, product_type_id);
