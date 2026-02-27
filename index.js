const express = require('express');
const pool = require('./src/db');
const redisClient = require('./src/redis');
const app = express();
const PORT = 3000;

app.use(express.json());

// 1. Home route - if you see this, the server is working
app.get('/', (req, res) => {
  res.send('Welcome to the Inventory Engine! Try /test-db next.');
});

// 2. The DB test route.
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error("Error details:", err.message);
    res.status(500).send("Database Error: " + err.message);
  }
});

// Initialize Redis Cache with data from the Database
async function initRedis() {
  try {
    const result = await pool.query('SELECT id, stock_quantity FROM products');
    const products = result.rows;
    for (const prod of products) {
      await redisClient.set(`product:${prod.id}:stock`, prod.stock_quantity);
    }
    console.log("Redis initialized with stock from database");
  } catch (err) {
    console.error("Failed to initialize Redis:", err.message);
  }
}

// POST request to buy an item by ID
app.post('/buy/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    // ---- [PHASE 2] CACHE LAYER (Redis) ----
    const redisKey = `product:${productId}:stock`;

    // 1. Atomic decrement in Redis
    const newStock = await redisClient.decr(redisKey);

    // 2. Fast Fail if out of stock
    if (newStock < 0) {
      // Put it back to 0 just to avoid negative numbers in Redis
      await redisClient.incr(redisKey);
      return res.status(400).json({ message: "Out of stock! (Caught by Cache)" });
    }

    // ---- [PHASE 1] DATABASE LAYER ----
    // 3. Get a dedicated client from the pool for a transaction
    const client = await pool.connect();

    try {
      // 4. Start Transaction (Atomic block)
      await client.query('BEGIN');

      // 5. The Lock: Fetch stock and prevent others from editing this row
      const result = await client.query(
        'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      const product = result.rows[0];

      if (!product) {
        await client.query('ROLLBACK');
        // Undo the Redis deduction since product doesn't exist
        await redisClient.incr(redisKey);
        return res.status(404).json({ error: "Product not found" });
      }

      // 6. Logic: Only update if DB stock is available
      if (product.stock_quantity > 0) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = $1',
          [productId]
        );

        // 7. Success: Save changes and release lock
        await client.query('COMMIT');
        res.json({
          message: "Purchase successful!",
          remaining_stock: product.stock_quantity - 1
        });
      } else {
        // DB says out of stock, so our cache was out of sync.
        await client.query('ROLLBACK');
        // Fix the cache by syncing it up
        await redisClient.set(redisKey, 0);
        res.status(400).json({ message: "Out of stock!" });
      }
    } catch (err) {
      // Transaction failed, rollback DB and increment cache back
      await client.query('ROLLBACK');
      await redisClient.incr(redisKey);
      console.error("Transaction Error:", err.message);
      res.status(500).json({ error: "Transaction failed" });
    } finally {
      client.release();
    }
  } catch (redisErr) {
    console.error("Redis Error:", redisErr.message);
    res.status(500).json({ error: "Cache failed" });
  }
});

app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  // Initialize Redis Cache when server starts
  await initRedis();
});
