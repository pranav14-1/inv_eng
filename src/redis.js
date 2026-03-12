const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        tls: (process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss')) ? true : false
    }
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err.message);
    if (err.message.includes('Socket closed unexpectedly')) {
        console.log('Redis connection closed unexpectedly, attempting to reconnect...');
    }
});

redisClient.on('connect', () => console.log('Connected to Redis'));

// Initialize connection with error handling
(async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (err) {
        console.error("Initial Redis connection failed:", err.message);
    }
})();

module.exports = redisClient;
