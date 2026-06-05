const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://admin:password@localhost:5432/delegatecart?schema=public' });
p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
  .then(r => r.rows.forEach(row => console.log(row.table_name)))
  .catch(e => console.error(e.message))
  .finally(() => p.end());
