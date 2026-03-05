const pool = require('./src/db');
const redisClient = require('./src/redis');

async function setup() {
    const client = await pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0)
      );
    `);

        // Check if product 1 exists, if not insert it
        const res = await client.query('SELECT * FROM products WHERE id = 1');
        if (res.rows.length === 0) {
            await client.query("INSERT INTO products (name, stock_quantity) VALUES ('Flash Sale Item', 100)");
            console.log("Inserted product 1 with stock 100");
        } else {
            // Reset stock
            await client.query("UPDATE products SET stock_quantity = 100 WHERE id = 1");
            console.log("Reset product 1 stock to 100");
        }

        // Initialize Redis cache
        await redisClient.set('product:1:stock', 100);
        console.log("Initialized Redis cache for product 1 to 100");

    } catch (err) {
        console.error("Setup error:", err);
    } finally {
        client.release();
        pool.end();
        redisClient.quit();
        console.log("Setup complete");
    }
}

setup();
