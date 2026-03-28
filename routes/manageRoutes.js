const express = require('express');
const router  = express.Router();
const { auth } = require('../middleware/auth.middleware');
const Url = require('../models/urlSchema');

// GET — edit ad page
router.get('/manage/ad/:code', auth, async (req, res) => {
    try {
        const url = await Url.findOne({
            shortCode: req.params.code,
            createdBy: req.user.user
        });
        if (!url) return res.status(404).json({ error: 'URL nahi mila' });
        res.render('edit-ad', { url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST — save ad settings — JSON accept karta hai
router.post('/manage/ad/:code', auth, async (req, res) => {
    try {
        console.log("Body aaya:", req.body); // ← debug ke liye
        
        const { adEnabled, adTimer, adTitle, adDescription, adSkipable } = req.body;

        const updated = await Url.findOneAndUpdate(
            { shortCode: req.params.code, createdBy: req.user.user },
            {
                adEnabled:     adEnabled === true,
                adTimer:       Number(adTimer) || 5,
                adTitle:       adTitle || '',
                adDescription: adDescription || '',
                adSkipable:    adSkipable === true,
            },
            { new: true }
        );

        if (!updated) return res.status(404).json({ error: 'URL nahi mila' });

        res.json({ success: true }); // ✅ JSON response
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;