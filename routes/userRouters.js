const express = require('express');
const router = express.Router();

const {
    handleUserSignup,
    handleUserLogin,
    verifyOtp,
} = require('../controllers/userControllers');
const { handleContact } = require('../controllers/contactControllers');
const { authRateLimit, contactRateLimit } = require('../middleware/rateLimit.middleware');

// Views
router.get('/signup', (req, res) => res.render('signup', { error: null, success: null }));
router.get('/login', (req, res) => res.render('login', { error: null, success: null }));

// OTP
router.get('/verify-otp', (req, res) => {
    res.render('verify-otp', {
        error: null,
        email: req.query.email,
        user: null,
    });
});

// Actions
router.post('/signup', authRateLimit, handleUserSignup);
router.post('/login', authRateLimit, handleUserLogin);
router.post('/verify-otp', authRateLimit, verifyOtp);
router.post('/contact', contactRateLimit, handleContact);

module.exports = router;
