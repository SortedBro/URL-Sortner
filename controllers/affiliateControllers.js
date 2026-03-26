const AffiliateLink = require('../models/affiliateLinkSchema');
const ClickLog = require('../models/clickLogSchema');
const { nanoid } = require('nanoid');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

// Link create karo
exports.createLink = async (req, res) => {
    try {
        const { title, originalUrl, refParam } = req.body;

        if (!title || !originalUrl) {
            return res.status(400).json({ error: 'Title aur URL zaroori hai' });
        }

        const shortCode = nanoid(7);
        const shortUrl = `${req.protocol}://${req.get("host")}/a/${shortCode}`;

        const link = await AffiliateLink.create({
            title,
            originalUrl,
            shortCode,
            shortUrl,
            refParam: refParam || null,
            createdBy: req.user.user
        });

        res.status(201).json({ success: true, link });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Redirect + click track — updated
exports.trackAndRedirect = async (req, res) => {
    try {
        const link = await AffiliateLink.findOne({ shortCode: req.params.code });

        if (!link || !link.isActive) {
            return res.status(404).json({ message: 'Link nahi mila' });
        }

        // IP detect karo
        const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
        
        // Country detect karo geoip se
        const geo = geoip.lookup(ip);
        const country = geo?.country || 'Unknown';
        const city = geo?.city || 'Unknown';

        // Device + Browser detect karo
        const parser = new UAParser(req.headers['user-agent']);
        const ua = parser.getResult();
        const device = ua.device.type || 'desktop';
        const browser = ua.browser.name || 'Unknown';
        const os = ua.os.name || 'Unknown';

        // Click log save karo
        await ClickLog.create({
            link: link._id,
            ip,
            country,
            city,
            device,
            browser,
            os,
            referer: req.headers['referer'] || 'Direct'
        });

        // Total clicks update karo
        link.totalClicks += 1;
        await link.save();

        // refParam ke saath redirect karo
        let redirectTo = link.originalUrl;
        if (link.refParam) {
            const sep = redirectTo.includes('?') ? '&' : '?';
            redirectTo += `${sep}${link.refParam}`;
        }

        res.redirect(redirectTo);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Dashboard stats
exports.getDashboard = async (req, res) => {
    try {
        const links = await AffiliateLink.find({ createdBy: req.user.user })
                                         .sort({ createdAt: -1 });
        const totalClicks = links.reduce((sum, l) => sum + l.totalClicks, 0);

        // ✅ JSON nahi — EJS render karo
        res.render('affiliate-dashboard', {
            links,
            stats: {
                totalLinks:  links.length,
                totalClicks,
                activeLinks: links.filter(l => l.isActive).length
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Ek link ki detailed analytics

   exports.getLinkAnalytics = async (req, res) => {
    try {
        const link = await AffiliateLink.findOne({
            shortCode: req.params.code,
            createdBy: req.user.user
        });

        if (!link) return res.status(404).json({ error: 'Link nahi mila' });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const clickLogs = await ClickLog.find({
            link: link._id,
            clickedAt: { $gte: sevenDaysAgo }
        });

        // Daily clicks
        const dailyClicks = {};
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dailyClicks[date.toISOString().split('T')[0]] = 0;
        }
        clickLogs.forEach(log => {
            const key = log.clickedAt.toISOString().split('T')[0];
            if (dailyClicks[key] !== undefined) dailyClicks[key]++;
        });

        // Breakdowns
        const countryMap = {}, deviceMap = {}, browserMap = {};
        clickLogs.forEach(log => {
            countryMap[log.country] = (countryMap[log.country] || 0) + 1;
            deviceMap[log.device]   = (deviceMap[log.device]   || 0) + 1;
            browserMap[log.browser] = (browserMap[log.browser] || 0) + 1;
        });

        // ✅ JSON nahi — EJS render karo
        res.render('affiliate-analytics', {
            link,
            analytics: {
                dailyClicks,
                countries: countryMap,
                devices:   deviceMap,
                browsers:  browserMap,
                totalLogs: clickLogs.length
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteLink = async (req, res) => {
    try {
        await AffiliateLink.findOneAndDelete({
            shortCode:  req.params.code,
            createdBy:  req.user.user
        });
        res.redirect('/a/dashboard');
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

