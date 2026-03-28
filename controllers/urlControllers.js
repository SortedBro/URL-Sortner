const bcrypt = require('bcrypt');
const redis = require('ioredis');
const geoip = require('geoip-lite');
const { nanoid } = require('nanoid');
const UAParser = require('ua-parser-js');

const Url = require('../models/urlSchema');
const User = require('../models/userSchema');
const { incrementUrlCount } = require('../middleware/planLimit.middleware');

const redisClient = new redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    lazyConnect: true,
});

const COMPLEX_CACHE_SENTINEL = '__complex__';
const UNLOCK_COOKIE_PREFIX = 'unlock_';

const RESERVED_CODES = new Set([
    'signup',
    'login',
    'logout',
    'about',
    'dashboard',
    'pricing',
    'features',
    'privacy',
    'terms',
    'faq',
    'tools',
    'sitemap.xml',
    'verify-otp',
    'contact',
    'shorten',
    'a',
    'admin',
    'manage',
    'wallet',
    'payout',
    'panel',
    'bulk',
    'health',
    'brand',
    'sitemap',
    'settings',
    'unlock',
    'qr-codes',
]);

redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('error', (err) => console.warn('Redis error (non-fatal):', err.message));

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

function isValidDomain(domain) {
    if (!domain) return false;
    return /^(?=.{3,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain);
}

function requiresComplexHandling(url) {
    return Boolean(url.adEnabled || url.hasPassword || url.expiresAt || url.refParam);
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
            orginalUrl,
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

        if (!orginalUrl) {
            setCreateError(req, 'URL daalna zaroori hai');
            return res.redirect(returnPath);
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(orginalUrl);
        } catch {
            setCreateError(req, 'Valid URL daalo (https:// se shuru karo)');
            return res.redirect(returnPath);
        }

        const ownHost = req.get('host');
        if (parsedUrl.host === ownHost) {
            setCreateError(req, 'Apne hi domain ka URL short nahi kar sakte');
            return res.redirect(returnPath);
        }

        const customAlias = String(rawCustomAlias || '').trim();
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
            const aliasExists = await Url.findOne({ shortCode: customAlias });
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
            const existingUrl = await Url.findOne({ orginalUrl, createdBy: userId });
            if (existingUrl) {
                setCreateSuccess(req, existingUrl.shortUrl);
                return res.redirect(returnPath);
            }
        }

        let shortCode = customAlias || nanoid(6);
        if (!customAlias) {
            for (let attempt = 0; attempt < 5; attempt += 1) {
                const exists = await Url.findOne({ shortCode });
                if (!exists) break;
                shortCode = nanoid(6);
            }
        }

        const appBaseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const publicBaseUrl = whiteLabelDomain ? `https://${whiteLabelDomain}` : appBaseUrl;
        const shortUrl = `${publicBaseUrl}/${shortCode}`;

        const createdUrl = await Url.create({
            orginalUrl,
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
            requiresComplexHandling(createdUrl) ? COMPLEX_CACHE_SENTINEL : orginalUrl
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
        const code = req.params.code;
        const password = String(req.body.password || '').trim();

        const url = await Url.findOne({ shortCode: code });
        if (!url) {
            return res.status(404).render('404');
        }

        if (!url.hasPassword) {
            return res.redirect(`/${code}`);
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

        res.cookie(unlockCookieName(code), '1', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
        });

        return res.redirect(`/${code}`);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

exports.redirectUrl = async (req, res) => {
    try {
        const code = req.params.code;

        try {
            const cached = await redisClient.get(`link:${code}`);
            if (cached && cached !== COMPLEX_CACHE_SENTINEL) {
                setImmediate(() => trackClick(code, req).catch(console.error));
                return res.redirect(cached);
            }
        } catch (error) {
            console.warn('Redis get failed, falling back to DB:', error.message);
        }

        const url = await Url.findOne({ shortCode: code });
        if (!url) {
            return res.status(404).render('404');
        }

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

    await Url.findOneAndUpdate(
        { shortCode: code },
        {
            $inc: { clicks: 1 },
            $set: { lastClickedAt: new Date() },
            $push: {
                clickHistory: {
                    clickedAt: new Date(),
                    country: geo.country || 'Unknown',
                    city: geo.city || 'Unknown',
                    device: result.device.type || 'Desktop',
                    browser: result.browser.name || 'Unknown',
                    os: result.os.name || 'Unknown',
                    referrer: req.headers.referer || 'Direct',
                    ip,
                },
            },
        }
    );
}

exports.deleteUrl = async (req, res) => {
    try {
        const url = await Url.findOne({
            shortCode: req.params.code,
            createdBy: req.user.user,
        });

        if (!url) {
            return res.status(404).render('404');
        }

        try {
            await redisClient.del(`link:${req.params.code}`);
        } catch (error) {
            console.warn('Redis del failed (non-fatal):', error.message);
        }

        await url.deleteOne();
        return res.redirect('/dashboard');
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const url = await Url.findOne({
            shortCode: req.params.code,
            createdBy: req.user.user,
        });

        if (!url) {
            return res.status(404).render('404');
        }

        const last7Days = [];
        for (let i = 6; i >= 0; i -= 1) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

            const count = url.clickHistory.filter((c) => {
                const d = new Date(c.clickedAt);
                return d.toDateString() === date.toDateString();
            }).length;

            last7Days.push({ date: dateStr, count });
        }

        const countryCounts = {};
        url.clickHistory.forEach((c) => {
            const key = c.country || 'Unknown';
            countryCounts[key] = (countryCounts[key] || 0) + 1;
        });
        const countries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const cityCounts = {};
        url.clickHistory.forEach((c) => {
            const key = c.city || 'Unknown';
            cityCounts[key] = (cityCounts[key] || 0) + 1;
        });
        const cities = Object.entries(cityCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const deviceCounts = {};
        url.clickHistory.forEach((c) => {
            const key = c.device || 'Unknown';
            deviceCounts[key] = (deviceCounts[key] || 0) + 1;
        });
        const devices = Object.entries(deviceCounts).map(([name, count]) => ({ name, count }));

        const browserCounts = {};
        url.clickHistory.forEach((c) => {
            const key = c.browser || 'Unknown';
            browserCounts[key] = (browserCounts[key] || 0) + 1;
        });
        const browsers = Object.entries(browserCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const referrerCounts = {};
        url.clickHistory.forEach((c) => {
            const key = c.referrer || 'Direct';
            referrerCounts[key] = (referrerCounts[key] || 0) + 1;
        });
        const referrers = Object.entries(referrerCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const uniqueIps = new Set(url.clickHistory.map((c) => c.ip).filter(Boolean));

        return res.render('analytics', {
            url,
            user: req.user,
            last7Days,
            countries,
            cities,
            devices,
            browsers,
            referrers,
            uniqueVisitors: uniqueIps.size,
            totalClicks: url.clicks,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.serverOn = (req, res) => {
    res.status(200).json({ ok: true, message: 'Server running' });
};
