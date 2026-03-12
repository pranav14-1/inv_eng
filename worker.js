require('dotenv').config();
const amqp = require('amqplib');
const pool = require('./src/db');
const redisClient = require('./src/redis');

async function connectAndConsume() {
    try {
        // 1. Connect to RabbitMQ
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
        const channel = await connection.createChannel();

        // Ensure the queue exists
        const queueName = 'purchase_orders';
        await channel.assertQueue(queueName, { durable: true });

        // Only process one message at a time
        channel.prefetch(1);

        console.log(`Worker is waiting for messages in ${queueName}. To exit press CTRL+C`);

        channel.consume(queueName, async (msg) => {
            if (msg !== null) {
                const data = JSON.parse(msg.content.toString());
                console.log(`[Worker] Received purchase order for Product ID: ${data.productId}`);

                const success = await processOrder(data.productId);

                if (success) {
                    console.log(`[Worker] Successfully processed order for Product ID: ${data.productId}`);
                    channel.ack(msg); // Order completed, remove from queue
                } else {
                    console.log(`[Worker] Failed to process order for Product ID: ${data.productId}. Acknowledging to remove invalid order.`);
                    // We still ack invalid orders (e.g., out of stock in DB) to remove them from the queue so they aren't retried endlessly.
                    channel.ack(msg);
                }
            }
        }, {
            noAck: false // Require explicit acknowledgment
        });
    } catch (error) {
        console.error("Worker failed to start:", error);
    }
}

async function processOrder(productId) {
    const client = await pool.connect();
    const redisKey = `product:${productId}:stock`;

    try {
        // ---- [PHASE 1] DATABASE LAYER ----
        await client.query('BEGIN');

        // The Lock: Fetch stock and prevent others from editing this row
        const result = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE',
            [productId]
        );

        const product = result.rows[0];

        if (!product) {
            await client.query('ROLLBACK');
            // Fix cache just in case
            await redisClient.incr(redisKey);
            console.log(`[Worker] Product ${productId} not found in DB.`);
            return false;
        }

        if (product.stock_quantity > 0) {
            // Logic: Only update if DB stock is available
            await client.query(
                'UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = $1',
                [productId]
            );

            // Success: Save changes and release lock
            await client.query('COMMIT');
            return true;
        } else {
            // DB says out of stock, so our cache was out of sync.
            await client.query('ROLLBACK');
            // Fix the cache by syncing it up
            await redisClient.set(redisKey, 0);
            console.log(`[Worker] Product ${productId} is out of stock in DB. Cache updated.`);
            return false;
        }
    } catch (err) {
        // Transaction failed, rollback DB and increment cache back
        await client.query('ROLLBACK');
        await redisClient.incr(redisKey);
        console.error("[Worker] Transaction Error:", err.message);
        return false;
    } finally {
        client.release();
    }
}

// Start the worker
connectAndConsume();
