const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth.middleware');
const { adminAuth } = require('../middleware/admin.middleware');
const adminCtrl = require('../controllers/adminController');
const {
    getAdminPanel,
    approveCampaign,
    rejectCampaign
} = require('../controllers/adminController');

// Sabhi admin routes pe dono middleware


// ── Dashboard ──
router.get('/admin', auth, adminAuth, (req, res) => res.redirect('/admin/dashboard'));
router.get('/admin/dashboard', adminCtrl.getDashboard);
// ✅ isAdmin middleware — sirf admin access kar sake
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ error: 'Admin access chahiye' });
};

router.get('/panel', auth, isAdmin, getAdminPanel);
router.post('/approve/:id', auth, isAdmin, approveCampaign);
router.post('/reject/:id', auth, isAdmin, rejectCampaign);

// ── Users ──
router.get('/admin/users', auth, adminAuth, adminCtrl.getUsers);
router.post('/admin/users/:id/ban', auth, adminAuth, adminCtrl.toggleBan);
router.delete('/admin/users/:id', adminCtrl.deleteUser);

// ── URLs ──
router.get('/admin/urls', auth, adminAuth, adminCtrl.getUrls);
router.delete('/admin/urls/:id', auth, adminAuth, adminCtrl.deleteUrl);

module.exports = router;
