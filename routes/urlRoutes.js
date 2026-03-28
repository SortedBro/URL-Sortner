const express = require("express");
const { redirectUrl } = require('../controllers/urlControllers');
const { isReservedTopLevelPath } = require('../config/reservedPaths');

const router = express.Router();

// router.get("/health", serverOn);

// ✅ Sirf GET requests handle karo — POST/PUT/DELETE next() pe jaayein
router.get("/:code", (req, res, next) => {
    const code = req.params.code.toLowerCase();
    if (isReservedTopLevelPath(code)) return next();
    redirectUrl(req, res, next);
});

module.exports = router;
