const express = require('express');
const pool = require('./src/db');
const redisClient = require('./src/redis');
const queue = require('./src/queue');
const app = express();
const PORT = process.env.PORT || 3000;

// Allow CORS for Vercel deployment
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static('public')); // Serve the frontend files in 'public' directory

// 1. The DB test route.
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

// POST request to setup stock directly from the UI
app.post('/api/stock/:id', async (req, res) => {
  const { stock } = req.body;
  if (stock === undefined || stock < 0) {
    return res.status(400).json({ error: "Invalid stock value" });
  }
  try {
    // 1. Update Database
    await pool.query('UPDATE products SET stock_quantity = $1 WHERE id = $2', [stock, req.params.id]);

    // 2. Update Redis
    await redisClient.set(`product:${req.params.id}:stock`, stock);

    res.json({ message: `Stock set to ${stock}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to setup stock" });
  }
});

// GET request to check current stock quickly from Redis
app.get('/api/stock/:id', async (req, res) => {
  try {
    const stock = await redisClient.get(`product:${req.params.id}:stock`);
    if (stock === null) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ productId: req.params.id, stock: parseInt(stock, 10) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stock" });
  }
});

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

    // ---- [PHASE 3] QUEUE LAYER (RabbitMQ) ----
    const queued = await queue.publishToQueue('purchase_orders', { productId });

    if (queued) {
      return res.status(202).json({ message: "Order accepted and is processing." });
    } else {
      // Put stock back in cache if queue fails
      await redisClient.incr(redisKey);
      return res.status(500).json({ error: "Failed to queue order." });
    }
  } catch (redisErr) {
    console.error("Redis Error:", redisErr.message);
    res.status(500).json({ error: "Cache failed" });
  }
});

// Keep-Alive / Ping route
app.get('/ping', (req, res) => res.send('pong'));

const worker = require('./worker');

app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  // Initialize Redis Cache when server starts
  await initRedis();
  // Initialize RabbitMQ Connection
  await queue.connectQueue(process.env.RABBITMQ_URL || 'amqp://localhost');
  // Initialize Background Worker (Consolidated for free hosting)
  worker.connectAndConsume().catch(err => console.error("Worker failed to start:", err));

  // Self-ping to keep Render free instance awake
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    console.log(`Keep-alive active: Pinging ${selfUrl} every 10 minutes`);
    setInterval(() => {
      fetch(`${selfUrl}/ping`).catch(err => console.error("Keep-alive ping failed:", err.message));
    }, 10 * 60 * 1000); // 10 minutes
  }
});
