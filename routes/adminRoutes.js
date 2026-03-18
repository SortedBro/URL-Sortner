const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth.middleware');
const { adminAuth } = require('../middleware/admin.middleware');
const adminCtrl = require('../controllers/adminController');

// Sabhi admin routes pe dono middleware


// ── Dashboard ──
router.get('/admin', auth, adminAuth, (req, res) => res.redirect('/admin/dashboard'));
router.get('/admin/dashboard', adminCtrl.getDashboard);

// ── Users ──
router.get('/admin/users', auth, adminAuth, adminCtrl.getUsers);
router.post('/admin/users/:id/ban', auth, adminAuth, adminCtrl.toggleBan);
router.delete('/admin/users/:id', adminCtrl.deleteUser);

// ── URLs ──
router.get('/admin/urls', auth, adminAuth, adminCtrl.getUrls);
router.delete('/admin/urls/:id', auth, adminAuth, adminCtrl.deleteUrl);

module.exports = router;
