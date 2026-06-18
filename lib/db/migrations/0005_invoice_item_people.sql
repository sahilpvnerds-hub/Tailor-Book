ALTER TABLE invoice_items
  ADD COLUMN family_member_id VARCHAR(36) NULL AFTER measurement_id,
  ADD COLUMN person_name VARCHAR(100) NULL AFTER family_member_id,
  ADD COLUMN relation VARCHAR(50) NULL AFTER person_name,
  ADD INDEX idx_invoice_items_family_member (family_member_id);
