const express = require('express');
const router  = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { adminAuth } = require('../middleware/admin.middleware');
const {
    getWallet,
    requestPayout,
    adminGetPayouts,
    adminApprovePayout,
    adminMarkPaid,
    adminRejectPayout
} = require('../controllers/payoutControllers');

// Affiliate routes
router.get('/wallet',          auth, getWallet);
router.post('/payout/request', auth, requestPayout);

// Admin routes
router.get('/admin/payouts',              auth, adminAuth, adminGetPayouts);
router.post('/admin/payouts/:id/approve', auth, adminAuth, adminApprovePayout);
router.post('/admin/payouts/:id/paid',    auth, adminAuth, adminMarkPaid);
router.post('/admin/payouts/:id/reject',  auth, adminAuth, adminRejectPayout);

module.exports = router;