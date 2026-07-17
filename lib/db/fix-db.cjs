const mysql = require('mysql2/promise');
async function main() {
    const pool = mysql.createPool({ uri: process.env.DATABASE_URL || 'mysql://root:admin123@localhost:3306/tailorbook' });
    const queries = [
        "ALTER TABLE orders ADD COLUMN photos json DEFAULT ('[]');",
        "ALTER TABLE measurements ADD COLUMN photos json DEFAULT ('[]');"
    ];
    for (const q of queries) {
        try {
            console.log('Running:', q);
            await pool.query(q);
            console.log('Success');
        } catch (e) {
            console.log('Error:', e.message);
        }
    }
    process.exit(0);
}
main();
