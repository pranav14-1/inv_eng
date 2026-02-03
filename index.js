const express = require('express');
const pool = require('./src/db');
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

// POST request to buy an item by ID
app.post('/buy/:id', async (req, res) => {
  const productId = req.params.id;
  
  // 1. Get a dedicated client from the pool for a transaction
  const client = await pool.connect();

  try {
    // 2. Start Transaction (Atomic block)
    await client.query('BEGIN');

    // 3. The Lock: Fetch stock and prevent others from editing this row
    const result = await client.query(
      'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );

    const product = result.rows[0];

    // Check if product exists
    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Product not found" });
    }

    // 4. Logic: Only update if stock is available
    if (product.stock_quantity > 0) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = $1',
        [productId]
      );

      // 5. Success: Save changes and release lock
      await client.query('COMMIT');
      res.json({ 
        message: "Purchase successful!", 
        remaining_stock: product.stock_quantity - 1 
      });
    } else {
      // 6. No stock: Release lock without changes
      await client.query('ROLLBACK');
      res.status(400).json({ message: "Out of stock!" });
    }
  } catch (err) {
    // 7. Error: Undo everything if something breaks
    await client.query('ROLLBACK');
    console.error("Transaction Error:", err.message);
    res.status(500).json({ error: "Transaction failed" });
  } finally {
    // 8. Crucial: Release the client back to the pool
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
