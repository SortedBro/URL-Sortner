const express = require("express")
const {createShortUrl,redirectUrl, serverOn}=require('../controllers/urlControllers')
const router = express.Router();




router.get("/:code",redirectUrl)
router.get("/health",serverOn)

router.post("/shorten",createShortUrl)



module.exports = router;