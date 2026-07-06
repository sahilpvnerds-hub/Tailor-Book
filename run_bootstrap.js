require('dotenv').config();

const mysql = require('mysql2/promise');

async function runBootstrap() {
  console.log('Running database bootstrap...');

  // Database connection
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'admin123',
    database: process.env.MYSQL_DATABASE || 'tailorbook',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
  });

  try {
    // Check if photos column exists in orders table
    const [rows] = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'orders'
        AND column_name = 'photos'
    `);

    if (rows[0].count === 0) {
      console.log('Adding photos column to orders table...');
      await pool.query(`
        ALTER TABLE orders
        ADD COLUMN photos JSON NULL DEFAULT ('[]')
        AFTER balance_due
      `);
      console.log('✅ photos column added successfully!');
    } else {
      console.log('✅ photos column already exists');
    }

    // Verify the column was created
    const [verifyRows] = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'orders'
        AND column_name = 'photos'
    `);

    console.log('Column details:', verifyRows[0]);

    // Check if updated_at column exists (for mobile cache issues)
    const [updatedAtCheck] = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'orders'
        AND column_name = 'updated_at'
    `);

    if (updatedAtCheck[0].count === 0) {
      console.log('Adding updated_at column to orders table...');
      await pool.query(`
        ALTER TABLE orders
        ADD COLUMN updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
        AFTER created_at
      `);
      console.log('✅ updated_at column added successfully!');
    }

    console.log('Bootstrap completed successfully!');

  } catch (error) {
    console.error('Bootstrap failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the bootstrap
runBootstrap().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});