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

    // Tüm tabloların sequence'larını mevcut MAX(id)+1 değerine sıfırla
    const tables = [
        'categories',
        'devices',
        'accessories',
        'customers',
        'orders',
        'order_items',
        'service_requests',
        'messages',
        'admins'
    ];

    for (const table of tables) {
        await client.query(`
            SELECT setval(
                pg_get_serial_sequence('${table}', 'id'),
                COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1,
                false
            )
        `);
        console.log(`${table} sequence sifirlandi`);
    }

    await client.end();
    console.log('Tum sequenceler guncellendi.');
}

run().catch(err => {
    console.error(err.message);
    process.exit(1);
});
