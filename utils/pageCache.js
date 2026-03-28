const { getCacheValue, setCacheValue } = require('./redisCache');

const DEFAULT_PAGE_TTL_SECONDS = 60;

function buildPageCacheKey(req, customKey) {
    if (customKey) return String(customKey);
    return `page:html:${String(req.path || '/').toLowerCase()}`;
}

function isCacheableAnonymousRequest(req) {
    if (req.method !== 'GET') return false;
    if (req.user) return false;
    if (req.session?.shortUrl || req.session?.error) return false;
    return Object.keys(req.query || {}).length === 0;
}

function applyPublicCacheHeaders(res, ttlSeconds) {
    const seconds = Math.max(Number(ttlSeconds) || 0, 1);
    res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
}

function cacheAnonymousPage({ ttlSeconds = DEFAULT_PAGE_TTL_SECONDS, key } = {}) {
    return async (req, res, next) => {
        if (!isCacheableAnonymousRequest(req)) {
            return next();
        }

        const cacheKey = buildPageCacheKey(req, typeof key === 'function' ? key(req) : key);
        if (!cacheKey) {
            return next();
        }

        const cachedHtml = await getCacheValue(cacheKey);
        if (cachedHtml) {
            applyPublicCacheHeaders(res, ttlSeconds);
            res.setHeader('X-Snaplink-Cache', 'HIT');
            return res.send(cachedHtml);
        }

        const originalRender = res.render.bind(res);
        res.render = (view, locals = {}, callback) => {
            if (typeof callback === 'function') {
                return originalRender(view, locals, callback);
            }

            return originalRender(view, locals, async (error, html) => {
                if (error) {
                    return next(error);
                }

                if (res.statusCode === 200) {
                    applyPublicCacheHeaders(res, ttlSeconds);
                    res.setHeader('X-Snaplink-Cache', 'MISS');
                    await setCacheValue(cacheKey, html, ttlSeconds);
                }

                return res.send(html);
            });
        };

        return next();
    };
}

module.exports = {
    cacheAnonymousPage,
};
