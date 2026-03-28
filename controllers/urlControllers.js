const bcrypt = require('bcrypt');
const geoip = require('geoip-lite');
const { nanoid } = require('nanoid');
const UAParser = require('ua-parser-js');

const Url = require('../models/urlSchema');
const User = require('../models/userSchema');
const { incrementUrlCount } = require('../middleware/planLimit.middleware');
const { RESERVED_TOP_LEVEL_PATHS } = require('../config/reservedPaths');
const { appConfig } = require('../config/appConfig');
const { dispatchUserWebhook } = require('../utils/webhooks');
const { cacheRedirectUrl, getCachedRedirectUrl, invalidateRedirectUrlCache } = require('../utils/urlCache');
const { enqueueUrlClick, flushClickQueueNow } = require('../utils/clickQueue');
const { isRedisEnabled } = require('../utils/redisCache');
const { invalidateAdminDashboardCache, invalidateUserUrlReadCaches } = require('../utils/readCache');

const UNLOCK_COOKIE_PREFIX = 'unlock_';
const SHORT_CODE_LENGTH = 6;
const MAX_SHORT_CODE_ATTEMPTS = 8;
const MAX_CLICK_HISTORY_ITEMS = 5000;
const ANALYTICS_RECENT_LIMIT = 200;
const REDIRECT_URL_SELECT =
    '_id shortCode shortUrl orginalUrl clicks createdBy isActive expiresAt hasPassword adEnabled adTimer adTitle adDescription adBannerUrl adSkipable refParam';
const UNLOCK_URL_SELECT = '_id shortCode hasPassword isActive expiresAt accessPasswordHash';

const RESERVED_CODES = new Set(RESERVED_TOP_LEVEL_PATHS);
function unlockCookieName(code) {
    return `${UNLOCK_COOKIE_PREFIX}${code}`;
}

function normalizeDomain(input = '') {
    if (!input) return '';
    return String(input)
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*/, '');
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidDomain(domain) {
    if (!domain) return false;
    return /^(?=.{3,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain);
}

async function generateUniqueShortCode() {
    for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt += 1) {
        const candidate = nanoid(SHORT_CODE_LENGTH).toLowerCase();
        // exists() is lighter than loading a full document when we only need uniqueness check.
        const exists = await Url.exists({ shortCode: candidate });
        if (!exists) return candidate;
    }

    return `${nanoid(SHORT_CODE_LENGTH + 2)}`.toLowerCase();
}

async function findUrlByShortCode(code, extraFilter = {}, options = {}) {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) return null;

    const selectFields = options.select || null;
    const useLean = Boolean(options.lean);
    const allowCaseInsensitiveFallback = options.allowCaseInsensitiveFallback !== false;

    const lowered = normalizedCode.toLowerCase();
    const candidates = [lowered];
    if (normalizedCode !== lowered) candidates.push(normalizedCode);

    for (const shortCode of candidates) {
        let query = Url.findOne({ ...extraFilter, shortCode });
        if (selectFields) query = query.select(selectFields);
        if (useLean) query = query.lean();
        const doc = await query;
        if (doc) return doc;
    }

    if (!allowCaseInsensitiveFallback) {
        return null;
    }

    let query = Url.findOne({
        ...extraFilter,
        shortCode: new RegExp(`^${escapeRegex(normalizedCode)}$`, 'i'),
    });
    if (selectFields) query = query.select(selectFields);
    if (useLean) query = query.lean();
    return query;
}

function normalizeClickDevice(deviceType) {
    const value = String(deviceType || '').toLowerCase();
    if (value === 'mobile') return 'Mobile';
    if (value === 'tablet') return 'Tablet';
    if (value === 'desktop') return 'Desktop';
    return 'Unknown';
}

function isExpired(url) {
    return Boolean(url.expiresAt && new Date(url.expiresAt).getTime() <= Date.now());
}

function getCreateReturnPath(req) {
    return req.body.returnTo === 'dashboard' ? '/dashboard' : '/';
}

function setCreateError(req, message) {
    if (req.session) req.session.error = message;
}

function setCreateSuccess(req, shortUrl) {
    if (req.session) req.session.shortUrl = shortUrl;
}

function sendShortLinkRedirect(res, destination) {
    if (!destination) {
        return res.status(500).json({ message: 'Redirect target missing' });
    }

    // Use a minimal redirect response instead of Express's HTML body wrapper so
    // short-link requests spend fewer bytes and less time in user-land code.
    res.status(302);
    res.setHeader('Location', String(destination));
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Length', '0');
    return res.end();
}

function buildClickContext(req) {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
    const geo = geoip.lookup(ip) || {};
    const ua = new UAParser(req.headers['user-agent']);
    const result = ua.getResult();

    return {
        ip,
        geo,
        result,
        clickedAt: new Date(),
    };
}

function buildClickUpdatePayload(req, clickedAt, geo, result, ip) {
    return {
        $inc: { clicks: 1 },
        $set: { lastClickedAt: clickedAt },
        $push: {
            clickHistory: {
                $each: [{
                    clickedAt,
                    country: geo.country || 'Unknown',
                    city: geo.city || 'Unknown',
                    device: normalizeClickDevice(result?.device?.type),
                    browser: result.browser.name || 'Unknown',
                    os: result.os.name || 'Unknown',
                    referrer: req.headers.referer || 'Direct',
                    ip,
                }],
                // Prevent unbounded document growth while preserving recent analytics.
                $slice: -MAX_CLICK_HISTORY_ITEMS,
            },
        },
    };
}

function buildClickWebhookPayload(urlDoc, req, clickedAt, geo, result, clicks) {
    return {
        shortCode: urlDoc.shortCode,
        shortUrl: urlDoc.shortUrl,
        originalUrl: urlDoc.orginalUrl,
        clicks,
        clickedAt: clickedAt.toISOString(),
        referrer: req.headers.referer || 'Direct',
        country: geo.country || 'Unknown',
        device: normalizeClickDevice(result?.device?.type),
        browser: result.browser.name || 'Unknown',
    };
}

async function persistClickImmediately(urlDoc, req, context) {
    await Url.updateOne(
        { _id: urlDoc._id },
        buildClickUpdatePayload(req, context.clickedAt, context.geo, context.result, context.ip)
    );
}

async function recordResolvedUrlClick(urlDoc, req) {
    if (!urlDoc?._id) return;

    const context = buildClickContext(req);
    const buffered = await enqueueUrlClick({
        urlId: urlDoc._id,
        shortCode: urlDoc.shortCode,
        shortUrl: urlDoc.shortUrl,
        orginalUrl: urlDoc.orginalUrl,
        createdBy: urlDoc.createdBy,
        clickedAt: context.clickedAt,
        country: context.geo.country || 'Unknown',
        city: context.geo.city || 'Unknown',
        device: normalizeClickDevice(context.result?.device?.type),
        browser: context.result.browser.name || 'Unknown',
        os: context.result.os.name || 'Unknown',
        referrer: req.headers.referer || 'Direct',
        ip: context.ip,
    });

    if (!buffered) {
        await persistClickImmediately(urlDoc, req, context);
    }

    if (urlDoc.createdBy) {
        setImmediate(() => {
            dispatchUserWebhook(
                urlDoc.createdBy,
                'link.clicked',
                buildClickWebhookPayload(
                    urlDoc,
                    req,
                    context.clickedAt,
                    context.geo,
                    context.result,
                    Number(urlDoc.clicks || 0) + 1
                )
            ).catch(console.error);
        });
    }
}

exports.createShortUrl = async (req, res) => {
    const returnPath = getCreateReturnPath(req);

    try {
        const {
            orginalUrl: legacyOriginalUrl,
            originalUrl: canonicalOriginalUrl,
            customAlias: rawCustomAlias,
            password: rawPassword,
            expiresAt: rawExpiresAt,
            whiteLabelDomain: rawWhiteLabelDomain,
            adEnabled,
            adTimer,
            adTitle,
            adDescription,
            adSkipable,
            refParam,
        } = req.body;

        // Keep supporting legacy `orginalUrl` while accepting production-grade `originalUrl`.
        const originalUrlInput = String(canonicalOriginalUrl || legacyOriginalUrl || '').trim();

        if (!originalUrlInput) {
            setCreateError(req, 'URL daalna zaroori hai');
            return res.redirect(returnPath);
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(originalUrlInput);
        } catch {
            setCreateError(req, 'Valid URL daalo (https:// se shuru karo)');
            return res.redirect(returnPath);
        }

        const ownHost = req.get('host');
        if (parsedUrl.host === ownHost) {
            setCreateError(req, 'Apne hi domain ka URL short nahi kar sakte');
            return res.redirect(returnPath);
        }

        const customAlias = String(rawCustomAlias || '').trim().toLowerCase();
        const password = String(rawPassword || '').trim();
        const expiresAtValue = String(rawExpiresAt || '').trim();

        const userId = req.user?.user || null;
        const userDoc = userId
            ? await User.findById(userId).select('plan whiteLabel').lean()
            : null;

        const plan = userDoc?.plan || req.user?.plan || 'free';
        const isPremium = plan === 'pro' || plan === 'business';
        const isBusiness = plan === 'business';

        if ((customAlias || password || expiresAtValue) && !isPremium) {
            setCreateError(req, 'Custom alias, password aur expiry Pro/Business me available hain');
            return res.redirect(returnPath);
        }

        let whiteLabelDomain = normalizeDomain(rawWhiteLabelDomain);
        if (!whiteLabelDomain && isBusiness && userDoc?.whiteLabel?.enabled) {
            whiteLabelDomain = normalizeDomain(userDoc.whiteLabel.customDomain);
        }

        if (whiteLabelDomain && !isBusiness) {
            setCreateError(req, 'White-label domain sirf Business plan me available hai');
            return res.redirect(returnPath);
        }

        if (whiteLabelDomain && !isValidDomain(whiteLabelDomain)) {
            setCreateError(req, 'White-label domain valid format me daalo, example: links.brand.com');
            return res.redirect(returnPath);
        }

        if (customAlias) {
            if (!/^[a-zA-Z0-9_-]{3,40}$/.test(customAlias)) {
                setCreateError(req, 'Custom alias me sirf letters, numbers, - aur _ allowed hain (3-40 chars)');
                return res.redirect(returnPath);
            }
            if (RESERVED_CODES.has(customAlias.toLowerCase())) {
                setCreateError(req, 'Ye alias reserved hai, koi aur alias try karo');
                return res.redirect(returnPath);
            }
        }

        if (customAlias) {
            const aliasExists =
                (await Url.exists({ shortCode: customAlias })) ||
                (await Url.exists({
                    shortCode: new RegExp(`^${escapeRegex(customAlias)}$`, 'i'),
                }));
            if (aliasExists) {
                setCreateError(req, 'Ye alias already le liya gaya hai');
                return res.redirect(returnPath);
            }
        }

        let expiresAt = null;
        if (expiresAtValue) {
            expiresAt = new Date(expiresAtValue);
            if (Number.isNaN(expiresAt.getTime())) {
                setCreateError(req, 'Expiry date valid nahi hai');
                return res.redirect(returnPath);
            }
            if (expiresAt.getTime() <= Date.now()) {
                setCreateError(req, 'Expiry date future ki honi chahiye');
                return res.redirect(returnPath);
            }
        }

        let accessPasswordHash = '';
        if (password) {
            if (password.length < 4) {
                setCreateError(req, 'Password kam se kam 4 characters ka hona chahiye');
                return res.redirect(returnPath);
            }
            accessPasswordHash = await bcrypt.hash(password, 10);
        }

        const hasAdvancedSettings = Boolean(
            customAlias ||
            password ||
            expiresAtValue ||
            whiteLabelDomain ||
            adEnabled === 'on' ||
            adEnabled === true ||
            refParam
        );

        if (!hasAdvancedSettings) {
            const existingUrl = await Url.findOne({
                orginalUrl: originalUrlInput,
                createdBy: userId,
            })
                .select('shortUrl')
                .lean();
            if (existingUrl) {
                setCreateSuccess(req, existingUrl.shortUrl);
                return res.redirect(returnPath);
            }
        }

        const shortCode = customAlias || (await generateUniqueShortCode());

        const appBaseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const publicBaseUrl = whiteLabelDomain ? `https://${whiteLabelDomain}` : appBaseUrl;
        const shortUrl = `${publicBaseUrl}/${shortCode}`;

        const createdUrl = await Url.create({
            orginalUrl: originalUrlInput,
            shortCode,
            shortUrl,
            customAlias,
            createdBy: userId,
            adEnabled: adEnabled === 'on' || adEnabled === true,
            adTimer: Number(adTimer) || 5,
            adTitle: adTitle || '',
            adDescription: adDescription || '',
            adSkipable: adSkipable !== 'off',
            expiresAt: expiresAt || undefined,
            hasPassword: Boolean(accessPasswordHash),
            accessPasswordHash,
            whiteLabelDomain,
            refParam: refParam || null,
        });

        await cacheRedirectUrl(createdUrl);
        if (userId) {
            await invalidateUserUrlReadCaches(userId, createdUrl.shortCode);
        }
        await invalidateAdminDashboardCache();

        if (userId) {
            await incrementUrlCount(userId);

            setImmediate(() => {
                dispatchUserWebhook(userId, 'link.created', {
                    shortCode: createdUrl.shortCode,
                    shortUrl: createdUrl.shortUrl,
                    originalUrl: createdUrl.orginalUrl,
                }).catch(console.error);
            });
        }

        setCreateSuccess(req, shortUrl);
        return res.redirect(returnPath);
    } catch (error) {
        console.log(error);
        setCreateError(req, 'Something went wrong');
        return res.redirect(returnPath);
    }
};

exports.unlockProtectedUrl = async (req, res) => {
    try {
        const code = String(req.params.code || '').trim();
        const password = String(req.body.password || '').trim();

        const url = await findUrlByShortCode(code, {}, {
            select: UNLOCK_URL_SELECT,
            lean: true,
        });
        if (!url) {
            return res.status(404).render('404');
        }

        const resolvedCode = String(url.shortCode || code);

        if (!url.hasPassword) {
            return res.redirect(`/${resolvedCode}`);
        }

        if (!url.isActive || isExpired(url)) {
            return res.status(410).render('link-expired', { url });
        }

        const isValidPassword = await bcrypt.compare(password, url.accessPasswordHash || '');
        if (!isValidPassword) {
            return res.status(401).render('protected-link', {
                url,
                error: 'Wrong password, dobara try karo',
            });
        }

        res.cookie(unlockCookieName(resolvedCode), '1', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
        });

        return res.redirect(`/${resolvedCode}`);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

exports.redirectUrl = async (req, res) => {
    try {
        const requestedCode = String(req.params.code || '').trim();
        if (!requestedCode) {
            return res.status(404).render('404');
        }

        const cachedUrl = await getCachedRedirectUrl(requestedCode);
        if (cachedUrl?.isLegacySimpleCache) {
            setImmediate(() => trackClickByCode(requestedCode, req).catch(console.error));
            return sendShortLinkRedirect(res, cachedUrl.orginalUrl);
        }

        if (cachedUrl) {
            if (!cachedUrl.isActive || isExpired(cachedUrl)) {
                return res.status(410).render('link-expired', { url: cachedUrl });
            }

            const cachedCode = String(cachedUrl.shortCode || requestedCode);

            if (cachedUrl.hasPassword) {
                const unlocked = req.cookies?.[unlockCookieName(cachedCode)] === '1';
                if (!unlocked) {
                    return res.status(401).render('protected-link', {
                        url: cachedUrl,
                        error: null,
                    });
                }
            }

            setImmediate(() => recordResolvedUrlClick(cachedUrl, req).catch(console.error));

            if (cachedUrl.adEnabled) {
                return res.render('ad-interstitial', {
                    url: {
                        orginalUrl: cachedUrl.orginalUrl,
                        adTimer: cachedUrl.adTimer || 5,
                        adTitle: cachedUrl.adTitle || 'Sponsored',
                        adDescription: cachedUrl.adDescription || '',
                        adBannerUrl: cachedUrl.adBannerUrl || '',
                        adSkipable: cachedUrl.adSkipable,
                        shortCode: cachedUrl.shortCode,
                    },
                });
            }

            let cachedRedirect = cachedUrl.orginalUrl;
            if (cachedUrl.refParam) {
                const separator = cachedRedirect.includes('?') ? '&' : '?';
                cachedRedirect += `${separator}${cachedUrl.refParam}`;
            }

            return sendShortLinkRedirect(res, cachedRedirect);
        }

        const url = await findUrlByShortCode(requestedCode, {}, {
            select: REDIRECT_URL_SELECT,
            lean: true,
        });
        if (!url) {
            return res.status(404).render('404');
        }

        const code = String(url.shortCode || requestedCode);

        if (!url.isActive || isExpired(url)) {
            return res.status(410).render('link-expired', { url });
        }

        await cacheRedirectUrl(url);

        if (url.hasPassword) {
            const unlocked = req.cookies?.[unlockCookieName(code)] === '1';
            if (!unlocked) {
                return res.status(401).render('protected-link', {
                    url,
                    error: null,
                });
            }
        }

        setImmediate(() => recordResolvedUrlClick(url, req).catch(console.error));

        if (url.adEnabled) {
            return res.render('ad-interstitial', {
                url: {
                    orginalUrl: url.orginalUrl,
                    adTimer: url.adTimer || 5,
                    adTitle: url.adTitle || 'Sponsored',
                    adDescription: url.adDescription || '',
                    adBannerUrl: url.adBannerUrl || '',
                    adSkipable: url.adSkipable,
                    shortCode: url.shortCode,
                },
            });
        }

        let redirectTo = url.orginalUrl;
        if (url.refParam) {
            const separator = redirectTo.includes('?') ? '&' : '?';
            redirectTo += `${separator}${url.refParam}`;
        }

        return sendShortLinkRedirect(res, redirectTo);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

async function trackClickByCode(code, req) {
    const normalizedCode = String(code || '').trim().toLowerCase();
    const context = buildClickContext(req);

    const url = await Url.findOneAndUpdate(
        { shortCode: normalizedCode },
        buildClickUpdatePayload(req, context.clickedAt, context.geo, context.result, context.ip),
        {
            new: true,
            select: 'shortCode shortUrl orginalUrl createdBy clicks',
        }
    );

    if (url?.createdBy) {
        setImmediate(() => {
            dispatchUserWebhook(
                url.createdBy,
                'link.clicked',
                buildClickWebhookPayload(
                    url,
                    req,
                    context.clickedAt,
                    context.geo,
                    context.result,
                    Number(url.clicks || 0)
                )
            ).catch(console.error);
        });
    }
}

exports.deleteUrl = async (req, res) => {
    try {
        const url = await findUrlByShortCode(req.params.code, {
            createdBy: req.user.user,
        }, {
            select: '_id shortCode shortUrl orginalUrl',
            lean: true,
        });

        if (!url) {
            return res.status(404).render('404');
        }

        await invalidateRedirectUrlCache(url.shortCode);
        await invalidateUserUrlReadCaches(req.user.user, url.shortCode);
        await invalidateAdminDashboardCache();

        const deletedPayload = {
            shortCode: url.shortCode,
            shortUrl: url.shortUrl,
            originalUrl: url.orginalUrl,
        };

        await Url.deleteOne({ _id: url._id });

        setImmediate(() => {
            dispatchUserWebhook(req.user.user, 'link.deleted', deletedPayload).catch(console.error);
        });

        return res.redirect('/dashboard');
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

function toLocalDateKey(dateInput) {
    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function incrementCounter(counter, key) {
    counter[key] = Number(counter[key] || 0) + 1;
}

function sortCountMap(counter, limit = Infinity) {
    return Object.entries(counter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));
}

function buildAnalyticsSummary(clickHistory) {
    const now = new Date();
    const dayBuckets = [];
    const dayCounts = {};

    for (let i = 6; i >= 0; i -= 1) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const key = toLocalDateKey(date);
        dayBuckets.push({
            key,
            label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        });
        dayCounts[key] = 0;
    }

    const countryCounts = {};
    const cityCounts = {};
    const deviceCounts = {};
    const browserCounts = {};
    const referrerCounts = {};
    const uniqueIps = new Set();

    clickHistory.forEach((click) => {
        const clickedAt = click?.clickedAt ? new Date(click.clickedAt) : null;
        if (clickedAt && !Number.isNaN(clickedAt.getTime())) {
            const dayKey = toLocalDateKey(clickedAt);
            if (dayCounts[dayKey] !== undefined) {
                dayCounts[dayKey] += 1;
            }
        }

        incrementCounter(countryCounts, click?.country || 'Unknown');
        incrementCounter(cityCounts, click?.city || 'Unknown');
        incrementCounter(deviceCounts, normalizeClickDevice(click?.device));
        incrementCounter(browserCounts, click?.browser || 'Unknown');
        incrementCounter(referrerCounts, click?.referrer || 'Direct');

        if (click?.ip) {
            uniqueIps.add(click.ip);
        }
    });

    const last7Days = dayBuckets.map((bucket) => ({
        date: bucket.label,
        count: Number(dayCounts[bucket.key] || 0),
    }));

    return {
        last7Days,
        countries: sortCountMap(countryCounts, 5),
        cities: sortCountMap(cityCounts, 5),
        devices: sortCountMap(deviceCounts),
        browsers: sortCountMap(browserCounts, 5),
        referrers: sortCountMap(referrerCounts, 5),
        uniqueVisitors: uniqueIps.size,
    };
}

exports.getAnalytics = async (req, res) => {
    try {
        if (isRedisEnabled()) {
            await flushClickQueueNow({ maxBatches: 20 });
        }

        const urlDoc = await findUrlByShortCode(req.params.code, {
            createdBy: req.user.user,
        }, {
            select:
                'shortCode shortUrl orginalUrl clicks createdAt lastClickedAt clickHistory.clickedAt clickHistory.country clickHistory.city clickHistory.device clickHistory.browser clickHistory.referrer clickHistory.ip',
            lean: true,
        });

        if (!urlDoc) {
            return res.status(404).render('404');
        }

        const clickHistory = Array.isArray(urlDoc.clickHistory) ? urlDoc.clickHistory : [];
        const analytics = buildAnalyticsSummary(clickHistory);
        const recentClicks = clickHistory
            .slice(-ANALYTICS_RECENT_LIMIT)
            .reverse()
            .map((click) => ({
            ...click,
            device: normalizeClickDevice(click?.device),
            }));

        const url = {
            shortCode: urlDoc.shortCode,
            shortUrl: urlDoc.shortUrl,
            originalUrl: String(urlDoc.orginalUrl || ''),
            orginalUrl: String(urlDoc.orginalUrl || ''),
            clicks: Number(urlDoc.clicks || 0),
            createdAt: urlDoc.createdAt,
            lastClickedAt: urlDoc.lastClickedAt,
        };

        return res.render('analytics', {
            url,
            user: req.user,
            clickHistory: recentClicks,
            ...analytics,
            totalClicks: Number(url.clicks || 0),
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.serverOn = (req, res) => {
    res.status(200).json({ ok: true, message: 'Server running' });
};

exports.buildAnalyticsSummary = buildAnalyticsSummary;
