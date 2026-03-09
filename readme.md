# ⚡ High-Concurrency Inventory Engine
*A specialized backend system designed to prevent overselling during high-traffic "Flash Sales"*

<p>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18.x-green.svg">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15.x-blue.svg">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-Cache-red.svg">
  <img alt="RabbitMQ" src="https://img.shields.io/badge/RabbitMQ-Queues-orange.svg">
</p>

---

## 🎯 The Problem: "Overselling"
During a flash sale (e.g., PS5 launch, concert tickets), thousands of users attempt to purchase the same limited-stock item at the exact same millisecond. If the backend is not properly synchronized, "Race Conditions" occur, allowing 500 users to successfully buy an item that only has 10 units in stock.

## 💡 The Solution
This project implements a highly scalable, data-integrous architecture to guarantee **zero overselling**, even under severe load tests of 500+ concurrent requests per second.

### Core Architectural Features:
1. **In-Memory Caching (Redis):** Handles the initial barrage of traffic with an atomic `DECR` operation, acting as a "Fast-Fail" mechanism to instantly reject users when stock theoretically hits zero.
2. **Message Queuing (RabbitMQ):** Accepted purchase intents are pushed to an asynchronous queue, decoupling the incoming web traffic from the heavy database lifting.
3. **Pessimistic Data Locking (PostgreSQL):** Worker nodes consume the queue and use `SELECT ... FOR UPDATE` to lock database rows at the hardware level, ensuring that the final source of truth decrements atomically and safely.

---

## 🛠 Tech Stack
* **Runtime:** Node.js, Express.js
* **Persistence:** PostgreSQL (Primary DB), Redis (In-Memory Cache)
* **Message Broker:** RabbitMQ
* **Performance Testing:** k6 (Standalone Load Testing Worker)

---

## 🚀 Getting Started

### Prerequisites
* Docker & Docker Compose (Recommended) OR
* Local installations of PostgreSQL, Redis, and RabbitMQ
* Node.js v16+

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pranav14-1/inv_eng.git
   cd inv_eng
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory:
   ```ini
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=inventory_db
   DB_PASSWORD=your_password
   DB_PORT=5432
   REDIS_URL=redis://localhost:6379
   RABBITMQ_URL=amqp://localhost
   ```

4. **Initialize Database:**
   ```bash
   node setup.js
   ```

5. **Run the Application:**
   *Terminal 1 (Web Server):*
   ```bash
   node index.js
   ```
   *Terminal 2 (Queue Worker):*
   ```bash
   node worker.js
   ```

---

## 📊 Benchmarks & Load Testing

To prove the system's integrity, this project includes a **k6 Load Test script** that forces severe race conditions to validate our architectural decisions.

**To run the test:**
```bash
npm run test:load
```

* **Test Conditions:** 500 Virtual Users, 10-second duration, max system throughput.
* **Results:** The Redis cache correctly fast-failed ~95% of requests instantly. The PostgreSQL lock securely processed the remaining valid orders. Stock mathematically bounded at **exactly 0 with 0 negative inventories**.

---

## 🗺️ Project Phases & Roadmap
- [x] **Phase 0:** Foundation & Environment Setup
- [x] **Phase 1:** Data Integrity (**Pessimistic Locking**)
- [x] **Phase 2:** Performance (**Redis Integration**)
- [x] **Phase 3:** Scalability (**Message Queues**)
- [x] **Phase 4:** Validation (**Load Testing**)
- [x] **Phase 5:** UI/Frontend (**Visualizing the Flash Sale**)
