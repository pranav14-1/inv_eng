const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

// Initialize connection
(async () => {
    await redisClient.connect();
})();

module.exports = redisClient;
