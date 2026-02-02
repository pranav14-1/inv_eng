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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
