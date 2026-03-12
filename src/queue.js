const amqp = require('amqplib');

let channel = null;

async function connectQueue(url = 'amqp://localhost') {
    try {
        const connection = await amqp.connect(url);
        channel = await connection.createChannel();
        await channel.assertQueue('purchase_orders', { durable: true });
        console.log("Connected to RabbitMQ and asserted queue: purchase_orders");
    } catch (error) {
        console.error("Failed to connect to RabbitMQ:", error);
        process.exit(1);
    }
}

async function publishToQueue(queueName, data) {
    if (!channel) {
        console.error("Channel is not established.");
        return false;
    }

    try {
        const message = Buffer.from(JSON.stringify(data));
        channel.sendToQueue(queueName, message, { persistent: true });
        return true;
    } catch (error) {
        console.error(`Failed to publish to queue ${queueName}:`, error);
        return false;
    }
}

module.exports = {
    connectQueue,
    publishToQueue
};
