import mysql from 'mysql2/promise';

async function test() {
  const url = process.env.DATABASE_URL || 'mysql://root:admin123@localhost:3306/tailorbook';
  console.log('Testing connection to:', url);
  try {
    const connection = await mysql.createConnection(url);
    console.log('Connection successful!');

    console.log('\n--- USERS ---');
    const [users] = await connection.execute('SELECT id, name, email, role, status FROM users');
    console.log(users);

    console.log('\n--- CUSTOMERS ---');
    const [customers] = await connection.execute('SELECT id, name, mobile, tailor_id FROM customers');
    console.log(customers);

    console.log('\n--- ORDERS ---');
    const [orders] = await connection.execute('SELECT id, order_number, customer_name, tailor_id FROM orders');
    console.log(orders);

    console.log('\n--- INVOICES ---');
    const [invoices] = await connection.execute('SELECT id, invoice_number, customer_name, tailor_id, total, status FROM invoices');
    console.log(invoices);

    await connection.end();
  } catch (err) {
    console.error('Failed:', err);
  }
}

test();
