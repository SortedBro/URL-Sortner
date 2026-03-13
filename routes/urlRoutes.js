const express = require("express")
const {createShortUrl,redirectUrl, serverOn}=require('../controllers/urlControllers');
const { handleUserSignUP ,handleUserLogin} = require("../controllers/userControllers");
const { handleContact } = require("../controllers/contactControllers");

const router = express.Router();



router.post("/",createShortUrl)
router.post("/signup",handleUserSignUP)
router.post("/login",handleUserLogin)

router.post('/contact', handleContact)


router.get("/health",serverOn)

router.get("/:code",redirectUrl)


module.exports = router;