const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    getUpgradePage,
    createOrder,
    verifyPayment,
    webhook,
} = require('../controllers/razorpayController');

// ✅ Upgrade page — login zaroori
router.get('/upgrade', auth, getUpgradePage);

// ✅ Create Razorpay order — login zaroori
router.post('/payment/create-order', auth, createOrder);

// ✅ Verify payment — login zaroori
router.post('/payment/verify', auth, verifyPayment);

// ✅ Webhook — Razorpay se aata hai (login nahi chahiye)
// raw body chahiye signature verify ke liye
router.post('/payment/webhook', express.raw({ type: 'application/json' }), webhook);

module.exports = router;
