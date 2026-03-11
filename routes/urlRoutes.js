const express = require("express")
const {createShortUrl,redirectUrl}=require('../controllers/urlControllers')
const router = express.Route();



router.post("/sorten",createShortUrl)
router.post("/:code",redirectUrl)