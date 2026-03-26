const express = require("express");
const { createShortUrl, redirectUrl, serverOn } = require('../controllers/urlControllers');

const router = express.Router();

// ✅ Specific routes PEHLE
// router.get("/health", serverOn);

// ✅ Wildcard BAAD MEIN — sirf 6-7 char codes match karo
router.get("/:code", (req, res, next) => {
    const code = req.params.code;
    
    // Ye words URL codes nahi hain — skip karo
    const reserved = [
        'signup', 'login', 'logout', 'about', 'dashboard',
        'pricing', 'features', 'privacy', 'terms', 'faq',
        'tools', 'sitemap.xml', 'verify-otp', 'contact',
        'shorten', 'a', 'admin', 'manage'
    ];
    
    if (reserved.includes(code)) return next(); // ✅ aage bhejo
    
    redirectUrl(req, res, next); // real short code hai — redirect karo
});

module.exports = router;
// ```

// ---

// ## Kyun Ye Problem Aayi
// ```
// Request: GET /signup
// ↓
// app.use('/', urlRoutes)  ← pehle match hua
// ↓
// router.get("/:code")     ← "signup" ko code samjha
// ↓
// DB mein "signup" shortCode dhundha → nahi mila → 404