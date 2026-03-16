const express = require('express');
const router = express.Router();

const { softAuth } = require('../middleware/auth.middleware');
const { createShortUrl } = require('../controllers/urlControllers');
const { checkPlanLimit, incrementUrlCount } = require('../middleware/planLimit.middleware');
const fetch = require('node-fetch');

// ── Home ──
router.get('/', softAuth, (req, res) => {
    const shortUrl = req.session.shortUrl || null;
    const error    = req.session.error    || null;
    req.session.shortUrl = null;
    req.session.error    = null;
    res.render('home', { shortUrl, error, user: req.user });
});

// ── Tools Page ──
router.get('/tools', softAuth, (req, res) => {
    res.render('tools', { user: req.user || null, shortUrl: null, error: null });
});

// ── URL Shortener (plan limit check ke saath) ──
router.post('/tools/shorten', softAuth, checkPlanLimit, incrementUrlCount, createShortUrl);

// ── YT Video Downloader ──
router.post('/tools/yt-download', async (req, res) => {
    try {
        const {
            url,
            videoQuality  = '1080',
            downloadMode  = 'auto',
            audioFormat   = 'mp3',
            filenameStyle = 'basic',
        } = req.body;

        if (!url) {
            return res.status(400).json({ status: 'error', error: { code: 'no_url' } });
        }

        // Step 1: Working instances fetch karo
        let workingInstances = [];
        try {
            const instancesRes = await fetch('https://instances.cobalt.best/api/instances.json', {
                headers: { 'User-Agent': 'SnapLink/1.0' },
                signal: AbortSignal.timeout(5000)
            });
            const allInstances = await instancesRes.json();

            workingInstances = allInstances.filter(i =>
                i.online === true &&
                i.info?.cors === true &&
                !i.info?.auth
            );
        } catch (e) {
            console.error('Instances fetch failed:', e.message);
        }

        // Step 2: Ek ek instance try karo (max 5)
        for (const instance of workingInstances.slice(0, 5)) {
            try {
                const apiUrl = `${instance.protocol}://${instance.api}`;

                const cobaltRes = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept':       'application/json',
                        'User-Agent':   'SnapLink/1.0',
                    },
                    body: JSON.stringify({
                        url,
                        videoQuality,
                        downloadMode,
                        audioFormat,
                        filenameStyle,
                        youtubeVideoCodec: 'h264',
                        alwaysProxy: false,
                    }),
                    signal: AbortSignal.timeout(8000)
                });

                if (cobaltRes.ok) {
                    const data = await cobaltRes.json();
                    if (data.status !== 'error') {
                        return res.json(data);
                    }
                }
            } catch (e) {
                continue; // Agla instance try karo
            }
        }

        return res.status(503).json({
            status: 'error',
            error: { code: 'all_failed', message: 'Koi bhi server available nahi hai. Thodi der baad try karo.' }
        });

    } catch (err) {
        console.error('YT download error:', err);
        return res.status(500).json({
            status: 'error',
            error: { code: 'server_error', message: err.message }
        });
    }
});

module.exports = router;
