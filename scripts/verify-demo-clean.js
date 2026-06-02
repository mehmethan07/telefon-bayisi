require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
  });

  await client.connect();

  const r = await client.query(
    `
      SELECT
        (SELECT COUNT(*) FROM orders WHERE tracking_code LIKE 'SP-100%') AS demo_orders,
        (SELECT COUNT(*) FROM service_requests WHERE tracking_code LIKE 'SRV-200%') AS demo_services,
        (SELECT COUNT(*) FROM messages WHERE phone LIKE '555%') AS demo_messages
    `
  );

  console.log(r.rows[0]);
  await client.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

