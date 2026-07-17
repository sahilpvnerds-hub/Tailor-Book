DROP PROCEDURE IF EXISTS CountCustomFieldUsage;
--> statement-breakpoint
CREATE PROCEDURE CountCustomFieldUsage(IN p_field_name VARCHAR(255))
BEGIN
  SELECT COUNT(*) AS cnt FROM measurements
  WHERE JSON_SEARCH(custom_measurements, 'one', p_field_name, NULL, '$[*].label') IS NOT NULL;
END;
