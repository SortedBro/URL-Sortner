const express = require('express')
const router = express.Router();


const { verifyOtp } = require('../controllers/userControllers');


router.get('/signup', (req, res) => res.render('signup', { error: null, success: null }));
router.get('/login', (req, res) => res.render('login', { error: null, success: null }));

// Get Otp page

router.get('/verify-otp', (req, res) => {

    res.render('verify-otp', {
        error: null,
        email: req.query.email,
        user: null

    }
    )

})

router.post('/verify-otp', verifyOtp);


module.exports = router;
