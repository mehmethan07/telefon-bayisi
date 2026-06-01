const db = require('./db');

async function test() {
    try {
        const metricsRes = await db.query(`
            SELECT 
                COUNT(*) as order_count, 
                SUM(total_price) as revenue_total,
                AVG(total_price) as avg_order_value
            FROM orders
            WHERE status != 'İptal Edildi'
        `);
        console.log("Metrics OK");

        const statusRes = await db.query("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
        console.log("Status OK");

        const dailyRes = await db.query(`
            SELECT DATE(order_date) as date, SUM(total_price) as revenue, COUNT(*) as count
            FROM orders
            WHERE status != 'İptal Edildi'
            GROUP BY DATE(order_date)
            ORDER BY DATE(order_date) ASC
        `);
        console.log("Daily OK");

        const topProductsRes = await db.query(`
            SELECT name, SUM(sales) as sales FROM (
                SELECT d.name, SUM(oi.quantity) as sales 
                FROM order_items oi JOIN devices d ON oi.device_id = d.id 
                GROUP BY d.name
                UNION ALL
                SELECT a.name, SUM(oi.quantity) as sales 
                FROM order_items oi JOIN accessories a ON oi.accessory_id = a.id 
                GROUP BY a.name
            ) AS combined_products
            GROUP BY name ORDER BY sales DESC LIMIT 5
        `);
        console.log("Top Products OK");

        const topBrandsRes = await db.query(`
            SELECT brand, SUM(sales) as sales FROM (
                SELECT d.brand, SUM(oi.quantity) as sales 
                FROM order_items oi JOIN devices d ON oi.device_id = d.id 
                GROUP BY d.brand
                UNION ALL
                SELECT a.brand, SUM(oi.quantity) as sales 
                FROM order_items oi JOIN accessories a ON oi.accessory_id = a.id 
                GROUP BY a.brand
            ) AS combined_brands
            GROUP BY brand ORDER BY sales DESC LIMIT 5
        `);
        console.log("Top Brands OK");

        const testBrands = await db.query(`
            SELECT brand, SUM(sales) as sales FROM (
                SELECT d.brand, COUNT(oi.id) as sales 
                FROM order_items oi JOIN devices d ON oi.device_id = d.id 
                GROUP BY d.brand
                UNION ALL
                SELECT a.brand, COUNT(oi.id) as sales 
                FROM order_items oi JOIN accessories a ON oi.accessory_id = a.id 
                GROUP BY a.brand
            ) AS combined_brands
            GROUP BY brand ORDER BY sales DESC LIMIT 3
        `);
        console.log("Dashboard Top Brands OK");
    } catch(err) {
        console.error("ERROR:", err.message);
    }
    process.exit(0);
}
test();
