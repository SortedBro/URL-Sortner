const express = require('express');
const { redirectUrl } = require('../controllers/urlControllers');
const { isReservedTopLevelPath } = require('../config/reservedPaths');

const router = express.Router();

function handleShortLinkRoute(req, res, next) {
    const code = String(req.params.code || '').toLowerCase();
    if (isReservedTopLevelPath(code)) return next();
    return redirectUrl(req, res, next);
}

router.get('/:code', handleShortLinkRoute);
router.head('/:code', handleShortLinkRoute);

module.exports = router;
