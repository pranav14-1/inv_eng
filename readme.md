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

## 🚀 Getting Started
1. **Clone the repo**
2. **Install dependencies:** `npm install`
3. **Setup Database:** Create a PostgreSQL database named `inventory_db` and a `products` table.
4. **Configure Environment:** Create a `.env` file with your DB credentials.
5. **Run Server:** `node index.js`
6. **Test Purchase:** `curl -X POST http://localhost:3000/buy/1`

## 📈 Roadmap
- [x] Phase 0: Foundation & Environment Setup
- [x] Phase 1: Data Integrity (**Pessimistic Locking**)
- [x] Phase 2: Performance (**Redis Integration**)
- [x] Phase 3: Scalability (**Message Queues**)
- [ ] Phase 4: Validation (**Load Testing**)
- [ ] Phase 5: UI/Frontend (**Visualizing the Flash Sale**)