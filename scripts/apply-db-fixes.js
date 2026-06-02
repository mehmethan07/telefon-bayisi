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

  const migrationQueries = [
    "ALTER TABLE devices ADD CONSTRAINT devices_stock_status_check CHECK (stock_status IN ('Stokta','Azalıyor','Tükendi'));",
    "ALTER TABLE accessories ADD CONSTRAINT accessories_stock_status_check CHECK (stock_status IN ('Stokta','Azalıyor','Tükendi'));",
    "ALTER TABLE orders ADD CONSTRAINT orders_tracking_code_check CHECK (tracking_code ~ '^SP-[0-9]{6}$');",
    "ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('Kredi Kartı','Nakit','Havale/EFT'));",
    "ALTER TABLE service_requests ADD CONSTRAINT service_requests_tracking_code_check CHECK (tracking_code ~ '^SRV-[0-9]{6}$');",
    "ALTER TABLE service_requests ADD CONSTRAINT service_requests_status_check CHECK (status IN ('Beklemede','Onarımda','Parça Bekleniyor','Tamamlandı','İptal'));",
    "CREATE OR REPLACE FUNCTION update_order_total() RETURNS TRIGGER AS $$ BEGIN UPDATE orders SET total_price = (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM order_items WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)) WHERE id = COALESCE(NEW.order_id, OLD.order_id); RETURN COALESCE(NEW, OLD); END; $$ LANGUAGE plpgsql;",
    "INSERT INTO admins (username, password) VALUES ('admin', '$2b$12$4sWztVX1vYU2bFT67iI.neE7i93H2rdW8brIHLsrvWPsmMSinJa12') ON CONFLICT (username) DO NOTHING;"
  ];

  for (const query of migrationQueries) {
    try {
      await client.query(query);
      console.log('OK');
    } catch (error) {
      if (error.code === '42710') {
        console.log('SKIP: constraint exists');
      } else {
        throw error;
      }
    }
  }

  const report = await client.query(`
    SELECT 'devices_invalid_stock' AS check_name, COUNT(*)::int AS invalid_count
    FROM devices
    WHERE stock_status NOT IN ('Stokta','Azalıyor','Tükendi')
    UNION ALL
    SELECT 'accessories_invalid_stock', COUNT(*)::int
    FROM accessories
    WHERE stock_status NOT IN ('Stokta','Azalıyor','Tükendi')
    UNION ALL
    SELECT 'orders_invalid_tracking', COUNT(*)::int
    FROM orders
    WHERE tracking_code !~ '^SP-[0-9]{6}$'
    UNION ALL
    SELECT 'orders_invalid_payment', COUNT(*)::int
    FROM orders
    WHERE payment_method NOT IN ('Kredi Kartı','Nakit','Havale/EFT')
    UNION ALL
    SELECT 'service_invalid_tracking', COUNT(*)::int
    FROM service_requests
    WHERE tracking_code !~ '^SRV-[0-9]{6}$'
    UNION ALL
    SELECT 'service_invalid_status', COUNT(*)::int
    FROM service_requests
    WHERE status NOT IN ('Beklemede','Onarımda','Parça Bekleniyor','Tamamlandı','İptal');
  `);

  console.log('REPORT_START');
  for (const row of report.rows) {
    console.log(`${row.check_name}:${row.invalid_count}`);
  }
  console.log('REPORT_END');

  await client.end();
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
