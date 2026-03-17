const Url = require('../models/urlSchema')
const { nanoid } = require('nanoid')
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const { incrementUrlCount } = require('../middleware/planLimit.middleware');

// ══════════════════════
//  Create Short URL
// ══════════════════════

exports.createShortUrl = async (req, res) => {
    try {
        const { orginalUrl, customAlias } = req.body;

        // ✅ Kahan se aaya — home ya tools
        const redirectBack = req.headers.referer?.includes('/tools')
            ? '/tools#tp-url'
            : '/';

        if (!orginalUrl) {
            req.session.error = "URL daalna zaroori hai";
            return res.redirect(redirectBack);
        }

        try {
            new URL(orginalUrl);
        } catch {
            req.session.error = "Valid URL daalo (https:// se shuru karo)";
            return res.redirect(redirectBack);
        }

        const ownDomain = req.get('host');
        if (orginalUrl.includes(ownDomain)) {
            req.session.error = "Apne hi domain ka URL short nahi kar sakte!";
            return res.redirect(redirectBack);
        }

        if (customAlias) {
            const aliasExists = await Url.findOne({ shortCode: customAlias });
            if (aliasExists) {
                req.session.error = "Ye alias already le liya gaya hai";
                return res.redirect(redirectBack);
            }
        }

        const userId = req.user?.user ?? null;

        const existingUrl = await Url.findOne({ orginalUrl, createdBy: userId });
        if (existingUrl) {
            const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
            req.session.shortUrl = `${baseUrl}/${existingUrl.shortCode}`;
            return res.redirect(redirectBack);
        }

        // ✅ Naya URL banao — result newUrl mein save karo
        const shortCode = customAlias || nanoid(6);
        const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

        const newUrl = await Url.create({
            orginalUrl,
            shortCode,
            shortUrl: `${baseUrl}/${shortCode}`,
            createdBy: userId,
        });

        // ✅ Count badhao
        if (userId) {
            await incrementUrlCount(userId);
        }

        // ✅ ShortUrl session mein save karo
        req.session.shortUrl = `${baseUrl}/${newUrl.shortCode}`;

        // ✅ Sirf ek redirect
        return res.redirect(redirectBack);

    } catch (error) {
        console.log(error);
        req.session.error = "Kuch gadbad hui";
        return res.redirect('/');
    }
}

// ══════════════════════
//  Redirect URL + Click Track
// ══════════════════════

exports.redirectUrl = async (req, res) => {
    try {
        const url = await Url.findOne({ shortCode: req.params.code });

        if (!url) {
            return res.status(404).render('404');
        }

        res.redirect(url.orginalUrl);

        const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
        const geo = geoip.lookup(ip) || {};

        const ua = new UAParser(req.headers['user-agent']);
        const result = ua.getResult();

        const device = result.device.type || "Desktop";
        const browser = result.browser.name;
        const os = result.os.name;
        const referrer = req.headers['referer'] || 'Direct';

        url.clicks += 1;
        url.lastClickedAt = new Date();
        url.clickHistory.push({
            clickedAt: new Date(),
            country: geo.country || 'Unknown',
            city: geo.city || 'Unknown',
            device,
            browser: browser || 'Unknown',
            os: os,
            referrer,
            ip,
        });

        await url.save();

    } catch (error) {
        console.log(error);
    }
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
            .sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const cityCounts = {};
        url.clickHistory.forEach(c => {
            const key = c.city || 'Unknown';
            cityCounts[key] = (cityCounts[key] || 0) + 1;
        });
        const cities = Object.entries(cityCounts)
            .sort((a, b) => b[1] - a[1]).slice(0, 5)
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
            .sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const referrerCounts = {};
        url.clickHistory.forEach(c => {
            const key = c.referrer || 'Direct';
            referrerCounts[key] = (referrerCounts[key] || 0) + 1;
        });
        const referrers = Object.entries(referrerCounts)
            .sort((a, b) => b[1] - a[1]).slice(0, 5)
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