import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'admin123',
    database: 'tailorbook'
  });

  try {
    const [orders] = await connection.execute('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1');
    console.log('--- LATEST ORDER ---');
    console.log(JSON.stringify(orders, null, 2));

    if (Array.isArray(orders) && orders.length > 0) {
      const orderId = (orders[0] as any).id;
      const [orderItems] = await connection.execute('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      console.log('\n--- LATEST ORDER ITEMS ---');
      console.log(JSON.stringify(orderItems, null, 2));
    }

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await connection.end();
  }
}

run();
