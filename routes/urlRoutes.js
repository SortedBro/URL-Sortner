const express = require("express");
const router = express.Router();

const { redirectUrl, createShortUrl } = require('../controllers/urlControllers');
const { softAuth } = require("../middleware/auth.middleware");
const { checkPlanLimit } = require("../middleware/planLimit.middleware");



router.get("/:code", redirectUrl);




module.exports = router;
