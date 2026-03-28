const Redis = require('ioredis');

const { appConfig } = require('../config/appConfig');

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const LOCAL_CACHE_MAX_ENTRIES = 5000;
const localCacheStore = new Map();

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

function nowInMs() {
    return Date.now();
}

function normalizeKey(key) {
    return key ? String(key) : '';
}

function pruneLocalCacheIfNeeded() {
    while (localCacheStore.size > LOCAL_CACHE_MAX_ENTRIES) {
        const oldestKey = localCacheStore.keys().next().value;
        if (!oldestKey) break;
        localCacheStore.delete(oldestKey);
    }
}

function setLocalCacheValue(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return;

    localCacheStore.set(normalizedKey, {
        value: String(value),
        expiresAt: nowInMs() + ((Number(ttlSeconds) || DEFAULT_TTL_SECONDS) * 1000),
    });
    pruneLocalCacheIfNeeded();
}

function getLocalCacheValue(key) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return null;

    const entry = localCacheStore.get(normalizedKey);
    if (!entry) return null;

    if (entry.expiresAt <= nowInMs()) {
        localCacheStore.delete(normalizedKey);
        return null;
    }

    return entry.value;
}

function deleteLocalCacheKeys(keys) {
    const normalizedKeys = (Array.isArray(keys) ? keys : [keys])
        .map(normalizeKey)
        .filter(Boolean);

    let deleted = 0;
    normalizedKeys.forEach((key) => {
        if (localCacheStore.delete(key)) {
            deleted += 1;
        }
    });

    return deleted;
}

function globToRegex(pattern) {
    const escaped = String(pattern)
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`);
}

function deleteLocalCacheKeysByPattern(patterns) {
    const normalizedPatterns = (Array.isArray(patterns) ? patterns : [patterns])
        .filter(Boolean)
        .map(globToRegex);

    if (!normalizedPatterns.length) return 0;

    let deleted = 0;
    for (const key of [...localCacheStore.keys()]) {
        if (normalizedPatterns.some((pattern) => pattern.test(key))) {
            localCacheStore.delete(key);
            deleted += 1;
        }
    }

    return deleted;
}

function isRedisEnabled() {
    return Boolean(redisClient);
}

async function getCacheValue(key) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return null;

    const localValue = getLocalCacheValue(normalizedKey);
    if (localValue !== null) {
        return localValue;
    }

    if (!redisClient) return null;

    try {
        const value = await redisClient.get(normalizedKey);
        if (value !== null) {
            setLocalCacheValue(normalizedKey, value);
        }
        return value;
    } catch (error) {
        console.warn('Redis get failed (non-fatal):', error.message);
        return null;
    }
}

async function setCacheValue(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return false;

    setLocalCacheValue(normalizedKey, value, ttlSeconds);
    if (!redisClient) return true;

    try {
        await redisClient.setex(normalizedKey, Number(ttlSeconds) || DEFAULT_TTL_SECONDS, String(value));
        return true;
    } catch (error) {
        console.warn('Redis set failed (non-fatal):', error.message);
        return false;
    }
}

async function deleteCacheKeys(keys) {
    const normalizedKeys = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(String);
    if (!normalizedKeys.length) return 0;

    const localDeleted = deleteLocalCacheKeys(normalizedKeys);
    if (!redisClient) return localDeleted;

    try {
        const redisDeleted = await redisClient.del(...normalizedKeys);
        return localDeleted + Number(redisDeleted || 0);
    } catch (error) {
        console.warn('Redis delete failed (non-fatal):', error.message);
        return localDeleted;
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
    const normalizedPatterns = (Array.isArray(patterns) ? patterns : [patterns])
        .filter(Boolean)
        .map(String);

    if (!normalizedPatterns.length) return 0;

    const localDeleted = deleteLocalCacheKeysByPattern(normalizedPatterns);
    if (!redisClient) return localDeleted;

    try {
        const matchedGroups = await Promise.all(
            normalizedPatterns.map((pattern) => findCacheKeys(pattern))
        );

        const keys = [...new Set(matchedGroups.flat().filter(Boolean))];
        if (!keys.length) return localDeleted;

        return localDeleted + (await redisClient.del(...keys));
    } catch (error) {
        console.warn('Redis delete by pattern failed (non-fatal):', error.message);
        return localDeleted;
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
