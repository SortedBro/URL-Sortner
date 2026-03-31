const express = require('express');
const router  = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { appConfig } = require('../config/appConfig');
const Url = require('../models/urlSchema');
const { cacheRedirectUrl } = require('../utils/urlCache');
const { invalidateAdminDashboardCache, invalidateUserUrlReadCaches } = require('../utils/readCache');

// GET - edit ad page
router.get('/manage/ad/:code', auth, async (req, res) => {
    try {
        const url = await Url.findOne({
            shortCode: req.params.code,
            createdBy: req.user.user,
        });
        if (!url) return res.status(404).json({ error: 'URL nahi mila' });
        res.render('edit-ad', {
            url,
            monetagZoneId: appConfig.monetagZoneId,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST - save ad settings - accepts JSON payload.
router.post('/manage/ad/:code', auth, async (req, res) => {
    try {
        const { adEnabled } = req.body;

        const updated = await Url.findOneAndUpdate(
            { shortCode: req.params.code, createdBy: req.user.user },
            {
                adEnabled: adEnabled === true,
            },
            { new: true }
        );

        if (!updated) return res.status(404).json({ error: 'URL nahi mila' });

        await cacheRedirectUrl(updated);
        await invalidateUserUrlReadCaches(req.user.user, updated.shortCode);
        await invalidateAdminDashboardCache();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
