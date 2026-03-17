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
// router.get('/tools', softAuth, (req, res) => {
//     res.render('tools', { user: req.user || null, shortUrl: null, error: null });
// });
// Tools page pe shortUrl aur error session se lo
router.get('/tools', softAuth, (req, res) => {
    const shortUrl = req.session.shortUrl || null;
    const error    = req.session.error    || null;
    req.session.shortUrl = null;  // ← clear karo
    req.session.error    = null;  // ← clear karo
    res.render('tools', { user: req.user || null, shortUrl, error })
   
});

// ── URL Shortener (plan limit check ke saath) ──
router.post('/tools/shorten', softAuth, checkPlanLimit, createShortUrl);

// ── YT Video Downloader ──


module.exports = router;
