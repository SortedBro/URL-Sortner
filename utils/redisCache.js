const Redis = require('ioredis');

const { appConfig } = require('../config/appConfig');

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

const redisClient = appConfig.redisUrl
    ? new Redis(appConfig.redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        lazyConnect: true,
    })
    : null;

if (redisClient) {
    redisClient.on('connect', () => console.log('Redis app cache connected.'));
    redisClient.on('error', (error) => console.warn('Redis cache error (non-fatal):', error.message));
}

function isRedisEnabled() {
    return Boolean(redisClient);
}

async function getCacheValue(key) {
    if (!redisClient || !key) return null;

    try {
        return await redisClient.get(String(key));
    } catch (error) {
        console.warn('Redis get failed (non-fatal):', error.message);
        return null;
    }
}

async function setCacheValue(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    if (!redisClient || !key) return false;

    try {
        await redisClient.setex(String(key), Number(ttlSeconds) || DEFAULT_TTL_SECONDS, String(value));
        return true;
    } catch (error) {
        console.warn('Redis set failed (non-fatal):', error.message);
        return false;
    }
}

async function deleteCacheKeys(keys) {
    if (!redisClient) return 0;

    const normalizedKeys = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(String);
    if (!normalizedKeys.length) return 0;

    try {
        return await redisClient.del(...normalizedKeys);
    } catch (error) {
        console.warn('Redis delete failed (non-fatal):', error.message);
        return 0;
    }
}

async function getJsonCache(key) {
    const rawValue = await getCacheValue(key);
    if (!rawValue) return null;

    try {
        return JSON.parse(rawValue);
    } catch (error) {
        console.warn('Redis JSON parse failed (non-fatal):', error.message);
        return null;
    }
}

async function setJsonCache(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    return setCacheValue(key, JSON.stringify(value), ttlSeconds);
}

async function findCacheKeys(pattern, count = 100) {
    if (!redisClient || !pattern) return [];

    const batchSize = Math.max(Number(count) || 0, 10);
    const foundKeys = [];
    let cursor = '0';

    try {
        do {
            const [nextCursor, keys] = await redisClient.scan(
                cursor,
                'MATCH',
                String(pattern),
                'COUNT',
                batchSize
            );

            if (Array.isArray(keys) && keys.length) {
                foundKeys.push(...keys);
            }

            cursor = nextCursor;
        } while (cursor !== '0');

        return foundKeys;
    } catch (error) {
        console.warn('Redis scan failed (non-fatal):', error.message);
        return [];
    }
}

async function deleteCacheKeysByPattern(patterns) {
    if (!redisClient) return 0;

    const normalizedPatterns = (Array.isArray(patterns) ? patterns : [patterns])
        .filter(Boolean)
        .map(String);

    if (!normalizedPatterns.length) return 0;

    try {
        const matchedGroups = await Promise.all(
            normalizedPatterns.map((pattern) => findCacheKeys(pattern))
        );

        const keys = [...new Set(matchedGroups.flat().filter(Boolean))];
        if (!keys.length) return 0;

        return await deleteCacheKeys(keys);
    } catch (error) {
        console.warn('Redis delete by pattern failed (non-fatal):', error.message);
        return 0;
    }
}

async function enqueueCacheListItem(key, payload) {
    if (!redisClient || !key) return false;

    try {
        await redisClient.lpush(String(key), String(payload));
        return true;
    } catch (error) {
        console.warn('Redis queue push failed (non-fatal):', error.message);
        return false;
    }
}

async function dequeueCacheListBatch(key, batchSize) {
    if (!redisClient || !key) return [];

    const normalizedBatchSize = Math.max(Number(batchSize) || 0, 1);

    try {
        const script = `
            local items = redis.call('LRANGE', KEYS[1], 0, ARGV[1] - 1)
            if #items > 0 then
                redis.call('LTRIM', KEYS[1], ARGV[1], -1)
            end
            return items
        `;

        const result = await redisClient.eval(script, 1, String(key), normalizedBatchSize);
        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.warn('Redis queue pop failed (non-fatal):', error.message);
        return [];
    }
}

module.exports = {
    DEFAULT_TTL_SECONDS,
    redisClient,
    isRedisEnabled,
    getCacheValue,
    getJsonCache,
    setCacheValue,
    setJsonCache,
    deleteCacheKeys,
    findCacheKeys,
    deleteCacheKeysByPattern,
    enqueueCacheListItem,
    dequeueCacheListBatch,
};
