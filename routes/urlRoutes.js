const express = require("express");
const router = express.Router();

const { redirectUrl } = require('../controllers/urlControllers');

// ── Redirect short URL — wildcard, isliye sabse neeche ──
router.get("/:code", redirectUrl);

module.exports = router;
