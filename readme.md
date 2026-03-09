# High-Concurrency Inventory Engine

A specialized backend system designed to handle "Flash Sale" scenarios where high traffic and data integrity are critical. This project demonstrates how to prevent "Overselling" using professional system design patterns.

## 🛠 Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Databases:** PostgreSQL (Primary), Redis (Cache Layer)
* **Libraries:** `pg` (node-postgres), `redis`, `dotenv`

## 📁 Project Structure
* `index.js`: Main entry point and API route definitions.
* `src/db.js`: Database connection logic using **Connection Pooling**.
* `src/redis.js`: Redis connection logic for fast-caching.
* `.env`: Configuration for sensitive database credentials.
* `.gitignore`: Prevents `node_modules` and `.env` from being tracked.

## ⚙️ Completed Features

### Phase 0: Foundation
* **REST API:** Basic endpoints for server health and database testing.
* **Database Integration:** Secure connection to a PostgreSQL relational database.
* **Connection Pooling:** Optimized database handshakes to handle concurrent requests.
* **Environment Configuration:** Separation of code and sensitive credentials using `dotenv`.

### Phase 1: Data Integrity (Concurrency Control)
* **Pessimistic Locking:** Implemented `SELECT ... FOR UPDATE` logic to lock database rows during a transaction.
* **Atomic Transactions:** Uses `BEGIN`, `COMMIT`, and `ROLLBACK` to ensure that stock checks and decrements happen as a single, unbreakable unit.
* **Race Condition Prevention:** Tested with concurrent scripts to ensure stock never drops below zero, even when multiple users buy simultaneously.

### Phase 2: Performance (Redis Integration)
* **In-Memory Caching:** Integrated Redis to handle the high volume of initial stock checks.
* **Atomic Decrement:** Utilized Redis `DECR` for fast, atomic operations without race conditions.
* **Fast-Fail Mechanism:** Instantly rejects invalid requests (out of stock), avoiding expensive PostgreSQL calls and drastically increasing throughput.

### Phase 4: Validation (Load Testing)
* **K6 Load Testing:** Implemented a `k6` load testing script to bombard the API with 500 concurrent virtual users and over 38,000 requests in 10 seconds.
* **Testing Tool Triumphs:** Initially struggled to use `Artillery` and `Autocannon` due to severe dependency resolution issues causing `npm install` blocks. Resolved this by leveraging `k6` as a standalone binary (written in Go) to avoid Node environment pollution and achieve maximum throughput.
* **Empirical Proof:** Queried the database after the load test completed and empirically proved that stock naturally bottlenecked exactly at 0 rather than dropping into negatives, confirming our data integrity patterns worked flawlessly.

## 🚀 Getting Started
1. **Clone the repo**
2. **Install dependencies:** `npm install`
3. **Setup Database:** Create a PostgreSQL database named `inventory_db` and a `products` table.
4. **Configure Environment:** Create a `.env` file with your DB credentials.
5. **Start Infrastructure:** Ensure Redis and RabbitMQ are running.
6. **Run Server:** `node index.js`
7. **Test Purchase:** `curl -X POST http://localhost:3000/buy/1`
8. **Load Test:** Install `k6` locally and run `npm run test:load`

## 📈 Roadmap
- [x] Phase 0: Foundation & Environment Setup
- [x] Phase 1: Data Integrity (**Pessimistic Locking**)
- [x] Phase 2: Performance (**Redis Integration**)
- [x] Phase 3: Scalability (**Message Queues**)
- [x] Phase 4: Validation (**Load Testing**)
- [x] Phase 5: UI/Frontend (**Visualizing the Flash Sale**)