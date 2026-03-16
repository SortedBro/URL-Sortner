const express = require('express');
const router = express.Router();

const {
    handleUserSignUP,
    handleUserLogin,
    verifyOtp
} = require('../controllers/userControllers');
const { handleContact } = require('../controllers/contactControllers');

// ── Views ──
router.get('/signup', (req, res) => res.render('signup', { error: null, success: null }));
router.get('/login',  (req, res) => res.render('login',  { error: null, success: null }));

// ── OTP ──
router.get('/verify-otp', (req, res) => {
    res.render('verify-otp', {
        error: null,
        email: req.query.email,
        user:  null
    });
});

// ── Actions ──
router.post('/signup',     handleUserSignUP);
router.post('/login',      handleUserLogin);
router.post('/verify-otp', verifyOtp);
router.post('/contact',    handleContact);

module.exports = router;
