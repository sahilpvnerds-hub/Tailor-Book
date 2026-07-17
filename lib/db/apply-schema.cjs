const fs = require('fs');
const mysql = require('mysql2/promise');
async function main(){
const pool = mysql.createPool({ uri: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/tailor_book' });
const sql = fs.readFileSync('drizzle/0001_glossy_solo.sql', 'utf8');
const stmts = sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
for(let stmt of stmts){
  console.log('Executing:\n'+stmt.slice(0,100)+'...');
  try { await pool.query(stmt); } catch(e) { console.error('Error:', e.message); }
}
process.exit(0);
}
main();