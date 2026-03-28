const {
    getJsonCache,
    setJsonCache,
    deleteCacheKeys,
    deleteCacheKeysByPattern,
} = require('./redisCache');

const USER_DASHBOARD_TTL_SECONDS = 30;
const API_LIST_TTL_SECONDS = 30;
const API_ITEM_TTL_SECONDS = 30;
const ADMIN_DASHBOARD_TTL_SECONDS = 30;

function toCacheId(value) {
    return String(value || '').trim().toLowerCase();
}

function buildUserDashboardCacheKey(userId) {
    const normalizedUserId = toCacheId(userId);
    return normalizedUserId ? `dashboard:data:${normalizedUserId}` : '';
}

function buildApiUrlListCacheKey(userId, page, limit) {
    const normalizedUserId = toCacheId(userId);
    if (!normalizedUserId) return '';
    return `api:url-list:${normalizedUserId}:${Number(page) || 1}:${Number(limit) || 25}`;
}

function buildApiUrlItemCacheKey(userId, shortCode) {
    const normalizedUserId = toCacheId(userId);
    const normalizedShortCode = toCacheId(shortCode);
    if (!normalizedUserId || !normalizedShortCode) return '';
    return `api:url-item:${normalizedUserId}:${normalizedShortCode}`;
}

function buildAdminDashboardCacheKey() {
    return 'admin:dashboard:v1';
}

async function getCachedUserDashboard(userId) {
    return getJsonCache(buildUserDashboardCacheKey(userId));
}

async function cacheUserDashboard(userId, payload) {
    const key = buildUserDashboardCacheKey(userId);
    if (!key || !payload) return false;
    return setJsonCache(key, payload, USER_DASHBOARD_TTL_SECONDS);
}

async function getCachedApiUrlList(userId, page, limit) {
    return getJsonCache(buildApiUrlListCacheKey(userId, page, limit));
}

async function cacheApiUrlList(userId, page, limit, payload) {
    const key = buildApiUrlListCacheKey(userId, page, limit);
    if (!key || !payload) return false;
    return setJsonCache(key, payload, API_LIST_TTL_SECONDS);
}

async function getCachedApiUrlItem(userId, shortCode) {
    return getJsonCache(buildApiUrlItemCacheKey(userId, shortCode));
}

async function cacheApiUrlItem(userId, shortCode, payload) {
    const key = buildApiUrlItemCacheKey(userId, shortCode);
    if (!key || !payload) return false;
    return setJsonCache(key, payload, API_ITEM_TTL_SECONDS);
}

async function getCachedAdminDashboard() {
    return getJsonCache(buildAdminDashboardCacheKey());
}

async function cacheAdminDashboard(payload) {
    const key = buildAdminDashboardCacheKey();
    if (!payload) return false;
    return setJsonCache(key, payload, ADMIN_DASHBOARD_TTL_SECONDS);
}

async function invalidateAdminDashboardCache() {
    return deleteCacheKeys(buildAdminDashboardCacheKey());
}

async function invalidateUserDashboardCache(userId) {
    return deleteCacheKeys(buildUserDashboardCacheKey(userId));
}

async function invalidateAllUserReadCaches(userId) {
    const normalizedUserId = toCacheId(userId);
    if (!normalizedUserId) return 0;

    const deletedDirect = await deleteCacheKeys(buildUserDashboardCacheKey(normalizedUserId));
    const deletedPattern = await deleteCacheKeysByPattern([
        `api:url-list:${normalizedUserId}:*`,
        `api:url-item:${normalizedUserId}:*`,
    ]);

    return deletedDirect + deletedPattern;
}

async function invalidateUserUrlReadCaches(userId, shortCode) {
    const normalizedUserId = toCacheId(userId);
    if (!normalizedUserId) return 0;

    const directKeys = [buildUserDashboardCacheKey(normalizedUserId)];
    const apiItemKey = buildApiUrlItemCacheKey(normalizedUserId, shortCode);
    if (apiItemKey) directKeys.push(apiItemKey);

    const deletedDirect = await deleteCacheKeys(directKeys.filter(Boolean));
    const deletedPattern = await deleteCacheKeysByPattern(`api:url-list:${normalizedUserId}:*`);

    return deletedDirect + deletedPattern;
}

module.exports = {
    getCachedUserDashboard,
    cacheUserDashboard,
    getCachedApiUrlList,
    cacheApiUrlList,
    getCachedApiUrlItem,
    cacheApiUrlItem,
    getCachedAdminDashboard,
    cacheAdminDashboard,
    invalidateAdminDashboardCache,
    invalidateUserDashboardCache,
    invalidateAllUserReadCaches,
    invalidateUserUrlReadCaches,
};
