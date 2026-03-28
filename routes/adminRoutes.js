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

// Dashboard
router.get('/admin', auth, adminAuth, (req, res) => res.redirect('/admin/dashboard'));
router.get('/admin/dashboard', auth, adminAuth, adminCtrl.getDashboard);

// Canonical campaign routes
router.get('/admin/campaigns', auth, adminAuth, getAdminPanel);
router.post('/admin/campaigns/:id/approve', auth, adminAuth, approveCampaign);
router.post('/admin/campaigns/:id/reject', auth, adminAuth, rejectCampaign);

// Backward-compatible aliases
router.get('/admin/panel', auth, adminAuth, (req, res) => res.redirect('/admin/campaigns'));
router.post('/admin/approve/:id', auth, adminAuth, approveCampaign);
router.post('/admin/reject/:id', auth, adminAuth, rejectCampaign);
router.get('/panel', auth, adminAuth, (req, res) => res.redirect('/admin/campaigns'));
router.post('/approve/:id', auth, adminAuth, approveCampaign);
router.post('/reject/:id', auth, adminAuth, rejectCampaign);

// Users
router.get('/admin/users', auth, adminAuth, adminCtrl.getUsers);
router.post('/admin/users/:id/ban', auth, adminAuth, adminCtrl.toggleBan);
router.delete('/admin/users/:id', auth, adminAuth, adminCtrl.deleteUser);

// URLs
router.get('/admin/urls', auth, adminAuth, adminCtrl.getUrls);
router.delete('/admin/urls/:id', auth, adminAuth, adminCtrl.deleteUrl);

module.exports = router;
