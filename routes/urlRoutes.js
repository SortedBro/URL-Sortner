const express = require("express");
const { createShortUrl, redirectUrl, serverOn } = require('../controllers/urlControllers');

const router = express.Router();

// router.get("/health", serverOn);

router.get("/:code", (req, res, next) => {
    const code = req.params.code;

    const reserved = [
        'signup', 'login', 'logout', 'about', 'dashboard',
        'pricing', 'features', 'privacy', 'terms', 'faq',
        'tools', 'sitemap.xml', 'verify-otp', 'contact',
        'shorten', 'a', 'admin', 'manage', 'brand',
        'wallet', 'payout', 'panel', 'bulk', 'health'
    ];

    if (reserved.includes(code.toLowerCase())) return next();

    redirectUrl(req, res, next);
});

module.exports = router;