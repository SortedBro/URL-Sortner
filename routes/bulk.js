const express = require('express');
const { nanoid } = require('nanoid');
const router = express.Router();

const Url = require('../models/urlSchema');
const User = require('../models/userSchema');
const { auth } = require('../middleware/auth.middleware');
const { cacheRedirectUrl } = require('../utils/urlCache');
const { invalidateAdminDashboardCache, invalidateAllUserReadCaches } = require('../utils/readCache');

const BULK_LIMIT = 500;

const getUniqueShortCode = async () => {
    for (let i = 0; i < 10; i++) {
        const candidate = nanoid(6);
        const exists = await Url.exists({ shortCode: candidate });
        if (!exists) return candidate;
    }
    return null;
};

router.post('/bulk-shorten', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.user).select('plan');
        if (!user) return res.redirect('/login');

        if (user.plan === 'free') {
            req.session.error = 'Bulk shortening Pro/Business plan mein available hai';
            return res.redirect('/dashboard?tab=bulk');
        }

        const rawInput = req.body.urls || '';
        const urlList = rawInput
            .split('\n')
            .map((u) => u.trim())
            .filter((u) => u.length > 0)
            .slice(0, BULK_LIMIT);

        if (urlList.length === 0) {
            req.session.error = 'Koi valid URL nahi mili';
            return res.redirect('/dashboard?tab=bulk');
        }

        const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const bulkResults = [];
        const errors = [];

        for (const originalUrl of urlList) {
            try {
                new URL(originalUrl);

                const already = await Url.findOne({
                    orginalUrl: originalUrl,
                    createdBy: req.user.user,
                }).select('shortCode');

                if (already) {
                    bulkResults.push({
                        original: originalUrl,
                        short: `${baseUrl}/${already.shortCode}`,
                        shortCode: already.shortCode,
                    });
                    continue;
                }

                const shortCode = await getUniqueShortCode();
                if (!shortCode) {
                    errors.push({ url: originalUrl, reason: 'Unique code generate nahi hua' });
                    continue;
                }

                const shortUrl = `${baseUrl}/${shortCode}`;
                const createdUrl = await Url.create({
                    orginalUrl: originalUrl,
                    shortUrl,
                    shortCode,
                    createdBy: req.user.user,
                    clicks: 0,
                });

                await cacheRedirectUrl(createdUrl);

                bulkResults.push({
                    original: originalUrl,
                    short: shortUrl,
                    shortCode,
                });
            } catch (urlErr) {
                errors.push({
                    url: originalUrl,
                    reason: urlErr.message || 'Invalid URL',
                });
            }
        }

        await invalidateAllUserReadCaches(req.user.user);
        await invalidateAdminDashboardCache();
        req.session.bulkResults = bulkResults;
        req.session.bulkErrors = errors;
        return res.redirect('/dashboard?tab=bulk');
    } catch (err) {
        console.error('Bulk shorten error:', err);
        req.session.error = 'Kuch galat ho gaya';
        return res.redirect('/dashboard?tab=bulk');
    }
});

module.exports = router;
