const mysql = require('mysql2/promise');

async function bootstrapDatabase() {
  try {
    // Create connection - use your database connection details
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'admin123',
      database: process.env.MYSQL_DATABASE || 'tailorbook',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log('Connected to database successfully!');

    // Check if photos column exists, if not add it
    const [rows] = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'orders'
        AND column_name = 'photos'
    `);

    const columnExists = rows[0].count > 0;

    if (!columnExists) {
      console.log('Adding photos column to orders table...');
      await pool.query(`
        ALTER TABLE orders
        ADD COLUMN photos JSON NULL DEFAULT ('[]')
        AFTER balance_due
      `);
      console.log('✅ photos column added successfully!');
    } else {
      console.log('✅ photos column already exists!');
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

    await pool.end();
    console.log('Database connection closed.');
    process.exit(0);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

bootstrapDatabase();