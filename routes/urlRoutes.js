const express = require("express");
const { redirectUrl, serverOn } = require('../controllers/urlControllers');

const router = express.Router();

const reserved = [
    'signup', 'login', 'logout', 'about', 'dashboard',
    'pricing', 'features', 'privacy', 'terms', 'faq',
    'tools', 'sitemap.xml', 'verify-otp', 'contact',
    'shorten', 'a', 'admin', 'manage', 'manage/ad',
    'wallet', 'payout', 'panel', 'bulk', 'health',
    'brand', 'sitemap'
];

// router.get("/health", serverOn);

// ✅ Sirf GET requests handle karo — POST/PUT/DELETE next() pe jaayein
router.get("/:code", (req, res, next) => {
    const code = req.params.code.toLowerCase();
    if (reserved.includes(code)) return next();
    redirectUrl(req, res, next);
});

module.exports = router;