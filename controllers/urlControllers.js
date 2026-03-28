const Url = require('../models/urlSchema')
const { nanoid } = require('nanoid')
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const { incrementUrlCount } = require('../middleware/planLimit.middleware');

// ══════════════════════
//  Redis Setup
// ══════════════════════
const redis = require('ioredis');
const redisClient = new redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    lazyConnect: true,
});

redisClient.on('connect', () => console.log('✅ Redis connected'));
redisClient.on('error', (err) => console.warn('⚠️ Redis error (non-fatal):', err.message));

console.log("urlcontroller page")

// ══════════════════════
//  Create Short URL
// ══════════════════════

exports.createShortUrl = async (req, res) => {
    try {
        const {
            orginalUrl,
            customAlias,
            adEnabled,      // ✅ naya
            adTimer,        // ✅ naya
            adTitle,        // ✅ naya
            adDescription,  // ✅ naya
            adSkipable      // ✅ naya



        } = req.body;

        // if (!orginalUrl) {
        //     req.session.error = "URL daalna zaroori hai";
        //     return res.redirect('/');
        // }
        if (!orginalUrl) {
            return res.render('home', { error: 'URL daalna zaroori hai', shortUrl: null });
        }

        try {
            new URL(orginalUrl);
        } catch {
            req.session.error = "Valid URL daalo (https:// se shuru karo)";
            return res.redirect('/');
        }

        const ownDomain = req.get('host');
        if (orginalUrl.includes(ownDomain)) {
            req.session.error = "Apne hi domain ka URL short nahi kar sakte!";
            return res.redirect('/');
        }

        if (customAlias) {
            const aliasExists = await Url.findOne({ shortCode: customAlias });
            if (aliasExists) {
                req.session.error = "Ye alias already le liya gaya hai";
                return res.redirect('/');
            }
        }

        const userId = req.user?.user ?? null;

        const existingUrl = await Url.findOne({ orginalUrl, createdBy: userId });
        if (existingUrl) {
            const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
            const shortUrl = `${baseUrl}/${existingUrl.shortCode}`;
            req.session.shortUrl = shortUrl;
            return res.redirect('/');
        }

        const shortCode = customAlias || nanoid(6);
        const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        const shortUrl = `${baseUrl}/${shortCode}`;

        const newUrl = await Url.create({
            orginalUrl,
            shortCode,
            shortUrl,
            createdBy: userId,
            //ads 
            adEnabled: adEnabled === 'on' || adEnabled === true,
            adTimer: Number(adTimer) || 5,
            adTitle: adTitle || '',
            adDescription: adDescription || '',
            adSkipable: adSkipable !== 'off',

            refParam: req.body.refParam || null  // form se aayega
        });

        // ✅ Cache the new URL in Redis immediately
        try {
            await redisClient.setex(`link:${shortCode}`, 86400, orginalUrl);
        } catch (e) {
            console.warn('Redis set failed (non-fatal):', e.message);
        }

        if (userId) {
            await incrementUrlCount(userId);
        }

        req.session.shortUrl = `${baseUrl}/${newUrl.shortCode}`;
        res.redirect('/');

    } catch (error) {
        console.log(error);
        req.session.error = "Something went wrong";
        res.redirect('/');
    }
}


// ══════════════════════
//  Redirect URL + Click Track
// ══════════════════════

// exports.redirectUrl = async (req, res) => {
//     try {
//         const code = req.params.code;

//         // ══════════════════════════════════════
//         // ⚡ STEP 1: Check Redis cache first
//         // ══════════════════════════════════════
//         try {
//             const cachedUrl = await redisClient.get(`link:${code}`);
//             if (cachedUrl) {
//                 res.redirect(cachedUrl); // ~5ms — instant!

//                 // Track click async (don't block redirect)
//                 setImmediate(() => trackClick(code, req).catch(console.error));
//                 return;
//             }
//         } catch (e) {
//             console.warn('Redis get failed, falling back to DB:', e.message);
//         }

//         // ══════════════════════════════════════
//         // 🗄️ STEP 2: Cache miss — hit MongoDB
//         // Only fetch orginalUrl field — don't load
//         // entire document with full clickHistory!
//         // ══════════════════════════════════════
//         const url = await Url.findOne(
//             { shortCode: code },
//             { orginalUrl: 1 }  // ✅ projection — fetch ONLY what we need
//         );

//         if (!url) {
//             return res.status(404).render('404');
//         }

//         // Cache it for next time (24 hours)
//         try {
//             await redisClient.setex(`link:${code}`, 86400, url.orginalUrl);
//         } catch (e) {
//             console.warn('Redis set failed (non-fatal):', e.message);
//         }

//         // Send redirect immediately
//         res.redirect(url.orginalUrl);

//         // Track click async (don't block redirect)
//         setImmediate(() => trackClick(code, req).catch(console.error));




//         // // ✅ Affiliate tracking ke liye
//         try {
//             const url = await Url.findOne({ shortCode: req.params.code });

//             if (!url) return res.status(404).render('404');

//             // ✅ click detail save karo
//             url.clicks += 1;
//             url.lastClickedAt = new Date();
//             url.clickDetails.push({
//                 ip: req.ip,
//                 clickedAt: new Date()
//             });
//             await url.save();
//             // ✅ Ad check — enabled hai toh interstitial page dikhao
//             if (url.adEnabled) {
//                 return res.render('ad-interstitial', {
//                     originalUrl: url.orginalUrl,
//                     adTimer: url.adTimer || 5,
//                     adTitle: url.adTitle || 'Sponsored',
//                     adDescription: url.adDescription || '',
//                     adBannerUrl: url.adBannerUrl || '',
//                     adSkipable: url.adSkipable,
//                     shortCode: url.shortCode
//                 });
//             }

//             // Ad nahi hai — seedha redirect
//             // res.redirect(url.originalUrl);

//             // ✅ refParam original URL mein add karo
//             let redirectTo = url.orginalUrl;
//             if (url.refParam) {
//                 // already ? hai URL mein?
//                 const separator = redirectTo.includes('?') ? '&' : '?';
//                 redirectTo += `${separator}${url.refParam}`;
//             }

//             res.redirect(redirectTo);

//         } catch (error) {
//             console.error(error);
//             res.status(500).json({ message: "Server error" });
//         }




//     } catch (error) {
//         console.log(error);
//         res.status(500).json({ message: "Server Error" });
//     }


//     //

// }
exports.redirectUrl = async (req, res) => {
    try {
        const code = req.params.code;
 
        // ══════════════════════════════════════
        // ⚡ STEP 1: Redis cache check
        // '__ad__' sentinel = ad-enabled link, must load full doc
        // anything else   = plain URL, redirect immediately
        // ══════════════════════════════════════
        try {
            const cached = await redisClient.get(`link:${code}`);
            if (cached && cached !== '__ad__') {
                // Plain redirect — fast path
                setImmediate(() => trackClick(code, req).catch(console.error));
                return res.redirect(cached);
            }
            // cached === '__ad__' or cache miss — fall through to DB
        } catch (e) {
            console.warn('Redis get failed, falling back to DB:', e.message);
        }
 
        // ══════════════════════════════════════
        // 🗄️ STEP 2: Load full doc (needed for ad check + refParam)
        // ══════════════════════════════════════
        const url = await Url.findOne({ shortCode: code });
 
        if (!url) {
            return res.status(404).render('404');
        }
 
        // Update Redis cache with correct strategy
        try {
            if (url.adEnabled) {
                await redisClient.setex(`link:${code}`, 86400, '__ad__');
            } else {
                await redisClient.setex(`link:${code}`, 86400, url.orginalUrl);
            }
        } catch (e) {
            console.warn('Redis set failed (non-fatal):', e.message);
        }
 
        // Track click async — never blocks the response
        setImmediate(() => trackClick(code, req).catch(console.error));
 
        // ══════════════════════════════════════
        // 📢 STEP 3: Ad check — show interstitial if enabled
        // ══════════════════════════════════════
        if (url.adEnabled) {
            return res.render('ad-interstitial', {
                url: {
                    orginalUrl:    url.orginalUrl,
                    adTimer:       url.adTimer || 5,
                    adTitle:       url.adTitle || 'Sponsored',
                    adDescription: url.adDescription || '',
                    adBannerUrl:   url.adBannerUrl || '',
                    adSkipable:    url.adSkipable,
                    shortCode:     url.shortCode,
                }
            });
        }
 
        // ══════════════════════════════════════
        // 🔗 STEP 4: No ad — direct redirect (+ optional refParam)
        // ══════════════════════════════════════
        let redirectTo = url.orginalUrl;
        if (url.refParam) {
            const separator = redirectTo.includes('?') ? '&' : '?';
            redirectTo += `${separator}${url.refParam}`;
        }
 
        return res.redirect(redirectTo);
 
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
}
 


// ══════════════════════
//  Click Tracking (async, non-blocking)
// ══════════════════════

async function trackClick(code, req) {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
    const geo = geoip.lookup(ip) || {};
    const ua = new UAParser(req.headers['user-agent']);
    const result = ua.getResult();

    // ✅ Fix 3 — atomic update, never loads full document into memory
    // No findOne → modify → save. One DB op, minimal RAM usage.
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
                    os: result.os.name,
                    referrer: req.headers['referer'] || 'Direct',
                    ip,
                }
            }
        }
    );
}


// ══════════════════════
//  Delete URL
// ══════════════════════

exports.deleteUrl = async (req, res) => {
    try {
        const url = await Url.findOne({
            shortCode: req.params.code,
            createdBy: req.user.user,
        });

        if (!url) {
            return res.status(404).render('404');
        }

        // ✅ Remove from Redis cache too
        try {
            await redisClient.del(`link:${req.params.code}`);
        } catch (e) {
            console.warn('Redis del failed (non-fatal):', e.message);
        }

        await url.deleteOne();
        res.redirect('/dashboard');

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
}


// ══════════════════════
//  Analytics Page Data
// ══════════════════════

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
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

            const count = url.clickHistory.filter(c => {
                const d = new Date(c.clickedAt);
                return d.toDateString() === date.toDateString();
            }).length;

            last7Days.push({ date: dateStr, count });
        }

        const countryCounts = {};
        url.clickHistory.forEach(c => {
            const key = c.country || 'Unknown';
            countryCounts[key] = (countryCounts[key] || 0) + 1;
        });
        const countries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const cityCounts = {};
        url.clickHistory.forEach(c => {
            const key = c.city || 'Unknown';
            cityCounts[key] = (cityCounts[key] || 0) + 1;
        });
        const cities = Object.entries(cityCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const deviceCounts = {};
        url.clickHistory.forEach(c => {
            const key = c.device || 'Unknown';
            deviceCounts[key] = (deviceCounts[key] || 0) + 1;
        });
        const devices = Object.entries(deviceCounts)
            .map(([name, count]) => ({ name, count }));

        const browserCounts = {};
        url.clickHistory.forEach(c => {
            const key = c.browser || 'Unknown';
            browserCounts[key] = (browserCounts[key] || 0) + 1;
        });
        const browsers = Object.entries(browserCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const referrerCounts = {};
        url.clickHistory.forEach(c => {
            const key = c.referrer || 'Direct';
            referrerCounts[key] = (referrerCounts[key] || 0) + 1;
        });
        const referrers = Object.entries(referrerCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const uniqueIps = new Set(url.clickHistory.map(c => c.ip).filter(Boolean));

        res.render('analytics', {
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
        res.status(500).json({ message: "Server error" });
    }
}