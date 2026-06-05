const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://admin:password@localhost:5432/delegatecart?schema=public' });

async function main() {
  const tables = ['User', 'UserAddress', 'Wallet', 'WalletTransaction', 'WalletAuthorization', 'WalletSpendingLimit', 'WalletAuditLog', 'Order', 'OrderItem', 'ShoppingListSearch'];
  for (const t of tables) {
    const r = await p.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='${t}' ORDER BY ordinal_position`);
    console.log(`\n=== ${t} ===`);
    r.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default || ''}`));
  }
  p.end();
}
main().catch(e => { console.error(e.message); p.end(); });
