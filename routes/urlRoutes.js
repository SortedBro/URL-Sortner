const express = require("express");
const router = express.Router();
const { redirectUrl } = require('../controllers/urlControllers');

// Yeh saare known routes hain — redirect se bachao
const SKIP_ROUTES = [
  'login', 'register', 'dashboard', 'about',
  'pricing', 'features', 'faq', 'tools',
  'admin', 'api', 'shorten', 'logout',
  'sitemap.xml', 'manage', 'bulk', 'payment',
  'profile', 'settings', 'affiliate', 'contact'
];

router.get("/:code", (req, res, next) => {
  // Known route hai toh skip karo
  if (SKIP_ROUTES.includes(req.params.code.toLowerCase())) {
    return next('router'); // Agli route pe jaao
  }
  redirectUrl(req, res, next);
});

module.exports = router;