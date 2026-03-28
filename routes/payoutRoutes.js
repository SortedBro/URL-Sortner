const express = require('express');
const router  = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { adminAuth } = require('../middleware/admin.middleware');
const {
    getWallet,
    downloadWalletStatement,
    requestPayout,
    adminGetPayouts,
    adminApprovePayout,
    adminMarkPaid,
    adminRejectPayout
} = require('../controllers/payoutControllers');

// Canonical affiliate routes
router.get('/affiliate/wallet', auth, getWallet);
router.get('/affiliate/wallet/statements', auth, downloadWalletStatement);
router.post('/affiliate/payout-requests', auth, requestPayout);

// Backward-compatible affiliate aliases
router.get('/wallet', auth, getWallet);
router.get('/wallet/statement', auth, downloadWalletStatement);
router.post('/payout/request', auth, requestPayout);

// Canonical admin routes
router.get('/admin/payout-requests', auth, adminAuth, adminGetPayouts);
router.post('/admin/payout-requests/:id/approve', auth, adminAuth, adminApprovePayout);
router.post('/admin/payout-requests/:id/mark-paid', auth, adminAuth, adminMarkPaid);
router.post('/admin/payout-requests/:id/reject', auth, adminAuth, adminRejectPayout);

// Backward-compatible admin aliases
router.get('/admin/payouts', auth, adminAuth, (req, res) => res.redirect('/admin/payout-requests'));
router.post('/admin/payouts/:id/approve', auth, adminAuth, adminApprovePayout);
router.post('/admin/payouts/:id/paid', auth, adminAuth, adminMarkPaid);
router.post('/admin/payouts/:id/reject', auth, adminAuth, adminRejectPayout);

module.exports = router;
