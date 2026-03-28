const bcrypt = require('bcrypt');
const redis = require('ioredis');
const geoip = require('geoip-lite');
const { nanoid } = require('nanoid');
const UAParser = require('ua-parser-js');

const Url = require('../models/urlSchema');
const User = require('../models/userSchema');
const { incrementUrlCount } = require('../middleware/planLimit.middleware');
const { RESERVED_TOP_LEVEL_PATHS } = require('../config/reservedPaths');
const { appConfig } = require('../config/appConfig');

const redisClient = appConfig.redisUrl
    ? new redis(appConfig.redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        lazyConnect: true,
    })
    : null;

const COMPLEX_CACHE_SENTINEL = '__complex__';
const UNLOCK_COOKIE_PREFIX = 'unlock_';
const SHORT_CODE_LENGTH = 6;
const MAX_SHORT_CODE_ATTEMPTS = 8;
const MAX_CLICK_HISTORY_ITEMS = 5000;
const ANALYTICS_RECENT_LIMIT = 200;

const RESERVED_CODES = new Set(RESERVED_TOP_LEVEL_PATHS);

if (redisClient) {
    redisClient.on('connect', () => console.log('Redis connected'));
    redisClient.on('error', (err) => console.warn('Redis error (non-fatal):', err.message));
}

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

function requiresComplexHandling(url) {
    return Boolean(url.adEnabled || url.hasPassword || url.expiresAt || url.refParam);
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

    const candidates = [normalizedCode];
    const lowered = normalizedCode.toLowerCase();
    if (!candidates.includes(lowered)) candidates.push(lowered);

    for (const shortCode of candidates) {
        let query = Url.findOne({ ...extraFilter, shortCode });
        if (selectFields) query = query.select(selectFields);
        if (useLean) query = query.lean();
        const doc = await query;
        if (doc) return doc;
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

async function setCacheValue(shortCode, value) {
    if (!redisClient) return;
    try {
        await redisClient.setex(`link:${shortCode}`, 86400, value);
    } catch (error) {
        console.warn('Redis set failed (non-fatal):', error.message);
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
            ? await User.findById(userId).select('plan whiteLabel')
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
            const aliasExists = await Url.exists({
                shortCode: new RegExp(`^${escapeRegex(customAlias)}$`, 'i'),
            });
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
            });
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

        await setCacheValue(
            shortCode,
            requiresComplexHandling(createdUrl) ? COMPLEX_CACHE_SENTINEL : originalUrlInput
        );

        if (userId) {
            await incrementUrlCount(userId);
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

        const url = await findUrlByShortCode(code);
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

        if (redisClient) {
            try {
                const cached = await redisClient.get(`link:${requestedCode}`);
                if (cached && cached !== COMPLEX_CACHE_SENTINEL) {
                    setImmediate(() => trackClick(requestedCode, req).catch(console.error));
                    return res.redirect(cached);
                }
            } catch (error) {
                console.warn('Redis get failed, falling back to DB:', error.message);
            }
        }

        const url = await findUrlByShortCode(requestedCode);
        if (!url) {
            return res.status(404).render('404');
        }

        const code = String(url.shortCode || requestedCode);

        if (!url.isActive || isExpired(url)) {
            return res.status(410).render('link-expired', { url });
        }

        await setCacheValue(
            code,
            requiresComplexHandling(url) ? COMPLEX_CACHE_SENTINEL : url.orginalUrl
        );

        if (url.hasPassword) {
            const unlocked = req.cookies?.[unlockCookieName(code)] === '1';
            if (!unlocked) {
                return res.status(401).render('protected-link', {
                    url,
                    error: null,
                });
            }
        }

        setImmediate(() => trackClick(code, req).catch(console.error));

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

        return res.redirect(redirectTo);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

async function trackClick(code, req) {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
    const geo = geoip.lookup(ip) || {};
    const ua = new UAParser(req.headers['user-agent']);
    const result = ua.getResult();
    const clickedAt = new Date();

    await Url.findOneAndUpdate(
        { shortCode: code },
        {
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
        }
    );
}

exports.deleteUrl = async (req, res) => {
    try {
        const url = await findUrlByShortCode(req.params.code, {
            createdBy: req.user.user,
        });

        if (!url) {
            return res.status(404).render('404');
        }

        if (redisClient) {
            try {
                await redisClient.del(`link:${url.shortCode}`);
            } catch (error) {
                console.warn('Redis del failed (non-fatal):', error.message);
            }
        }

        await url.deleteOne();
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
