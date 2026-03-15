const express = require("express")
const {createShortUrl,redirectUrl, serverOn}=require('../controllers/urlControllers');
const { handleUserSignUP ,handleUserLogin} = require("../controllers/userControllers");
const { handleContact } = require("../controllers/contactControllers");
const { softAuth } = require("../middleware/auth.middleware");

// const { auth } = require("../middleware/auth.middleware");

const router = express.Router();



router.post("/",softAuth,createShortUrl);
router.post("/signup",handleUserSignUP);
router.post("/login",handleUserLogin);
router.post('/contact', handleContact);



router.get("/health",serverOn);
router.get("/:code",redirectUrl);




module.exports = router;