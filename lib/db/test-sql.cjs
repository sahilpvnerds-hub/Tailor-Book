const mysql = require('mysql2/promise');
async function main() {
  const pool = mysql.createPool({ uri: 'mysql://root:admin123@localhost:3306/tailorbook' });
  try {
    await pool.query('select `id`, `order_number`, `tailor_id`, `customer_id`, `customer_name`, `customer_mobile`, `status`, `delivery_date`, `notes`, `total_amount`, `advance_amount`, `balance_due`, `photos`, `created_at`, `updated_at` from `orders` where `orders`.`tailor_id` = ? order by `orders`.`created_at` desc', ['9e19a5c8-d6f0-47d7-a682-525298ec0f5f']);
    console.log('Query OK via mysql2 directly');
  } catch(e) {
    console.error('SQL Error:', e.message);
  }
  process.exit(0);
}
main();
