# High-Concurrency Inventory Engine

A specialized backend system designed to handle "Flash Sale" scenarios where high traffic and data integrity are critical. This project focuses on solving race conditions and ensuring 100% data consistency.

## 🛠 Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL
* **Libraries:** `pg` (node-postgres), `dotenv`

## 📁 Project Structure
* `index.js`: Main entry point and API route definitions.
* `src/db.js`: Database connection logic using **Connection Pooling**.
* `.env`: Configuration for sensitive database credentials.
* `.gitignore`: Prevents `node_modules` and `.env` from being tracked.

## ⚙️ Features (Phase 0)
* **REST API:** Basic endpoints for server health and database testing.
* **Database Integration:** Secure connection to a PostgreSQL relational database.
* **Connection Pooling:** Optimized database handshakes for concurrent requests.
* **Environment Configuration:** Separation of code and sensitive credentials.

## 🚀 Getting Started
1. **Clone the repo**
2. **Install dependencies:** `npm install`
3. **Setup Database:** Create a PostgreSQL database named `inventory_db` and a `products` table.
4. **Configure Environment:** Create a `.env` file with your DB credentials (User, Host, Password, Port).
5. **Run Server:** `node index.js`

## 📈 Roadmap
- [x] Phase 0: Foundation & Environment Setup
- [ ] Phase 1: Data Integrity (Pessimistic Locking)
- [ ] Phase 2: Performance (Redis Integration)
- [ ] Phase 3: Scalability (Message Queues)
- [ ] Phase 4: Load Testing