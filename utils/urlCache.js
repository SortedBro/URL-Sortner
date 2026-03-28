const {
    DEFAULT_TTL_SECONDS,
    getCacheValue,
    setCacheValue,
    deleteCacheKeys,
} = require('./redisCache');

const LEGACY_COMPLEX_CACHE_SENTINEL = '__complex__';

function normalizeShortCode(shortCode) {
    return String(shortCode || '').trim().toLowerCase();
}

function buildRedirectCacheKey(shortCode) {
    const normalized = normalizeShortCode(shortCode);
    return normalized ? `link:${normalized}` : '';
}

function toStringId(value) {
    return value ? String(value) : null;
}

function buildCachedRedirectPayload(urlDoc) {
    if (!urlDoc?.shortCode) return null;

    return {
        _id: toStringId(urlDoc._id),
        shortCode: normalizeShortCode(urlDoc.shortCode),
        shortUrl: String(urlDoc.shortUrl || ''),
        orginalUrl: String(urlDoc.orginalUrl || ''),
        createdBy: toStringId(urlDoc.createdBy),
        isActive: Boolean(urlDoc.isActive !== false),
        expiresAt: urlDoc.expiresAt ? new Date(urlDoc.expiresAt).toISOString() : null,
        hasPassword: Boolean(urlDoc.hasPassword),
        adEnabled: Boolean(urlDoc.adEnabled),
        adTimer: Number(urlDoc.adTimer || 5),
        adTitle: String(urlDoc.adTitle || ''),
        adDescription: String(urlDoc.adDescription || ''),
        adBannerUrl: String(urlDoc.adBannerUrl || ''),
        adSkipable: urlDoc.adSkipable !== false,
        refParam: urlDoc.refParam ? String(urlDoc.refParam) : '',
        clicks: Number(urlDoc.clicks || 0),
    };
}

async function cacheRedirectUrl(urlDoc, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const payload = buildCachedRedirectPayload(urlDoc);
    if (!payload) return false;

    return setCacheValue(
        buildRedirectCacheKey(payload.shortCode),
        JSON.stringify(payload),
        ttlSeconds
    );
}

async function getCachedRedirectUrl(shortCode) {
    const rawValue = await getCacheValue(buildRedirectCacheKey(shortCode));
    if (!rawValue || rawValue === LEGACY_COMPLEX_CACHE_SENTINEL) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed?.shortCode || !parsed?.orginalUrl) {
            return null;
        }
        return parsed;
    } catch (error) {
        if (/^https?:\/\//i.test(rawValue)) {
            return {
                shortCode: normalizeShortCode(shortCode),
                shortUrl: '',
                orginalUrl: rawValue,
                createdBy: null,
                isActive: true,
                expiresAt: null,
                hasPassword: false,
                adEnabled: false,
                adTimer: 5,
                adTitle: '',
                adDescription: '',
                adBannerUrl: '',
                adSkipable: true,
                refParam: '',
                clicks: 0,
                isLegacySimpleCache: true,
            };
        }

        return null;
    }
}

async function invalidateRedirectUrlCache(shortCode) {
    return deleteCacheKeys(buildRedirectCacheKey(shortCode));
}

async function invalidateRedirectUrlCaches(shortCodes) {
    const keys = (Array.isArray(shortCodes) ? shortCodes : [shortCodes])
        .map(buildRedirectCacheKey)
        .filter(Boolean);

    if (!keys.length) return 0;
    return deleteCacheKeys(keys);
}

module.exports = {
    buildCachedRedirectPayload,
    cacheRedirectUrl,
    getCachedRedirectUrl,
    invalidateRedirectUrlCache,
    invalidateRedirectUrlCaches,
};
