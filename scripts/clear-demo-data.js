require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
  });

  await client.connect();

  // Demo seed'leri hedef almak için tracking kodu/telefon desenleri kullanıyoruz.
  // Böylece uygulama üzerinden yeni oluşturulan kayıtlar daha az etkilenir.
  const queries = [
    {
      label: 'order_items',
      sql: "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE tracking_code LIKE 'SP-100%')",
    },
    {
      label: 'orders',
      sql: "DELETE FROM orders WHERE tracking_code LIKE 'SP-100%'",
    },
    {
      label: 'service_requests',
      sql: "DELETE FROM service_requests WHERE tracking_code LIKE 'SRV-200%'",
    },
    {
      label: 'messages',
      sql: "DELETE FROM messages WHERE phone LIKE '555%'",
    },
    {
      label: 'customers',
      sql: "DELETE FROM customers WHERE phone LIKE '555%'",
    },
  ];

  for (const q of queries) {
    const r = await client.query(q.sql);
    console.log(`${q.label}:${r.rowCount}`);
  }

  await client.end();
  console.log('DEMO_DATA_CLEAN_DONE');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

