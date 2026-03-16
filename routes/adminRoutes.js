const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth.middleware');
const { adminAuth } = require('../middleware/admin.middleware');
const adminCtrl = require('../controllers/adminController');

// Sabhi admin routes pe dono middleware
router.use(auth, adminAuth);

// ── Dashboard ──
router.get('/admin',           (req, res) => res.redirect('/admin/dashboard'));
router.get('/admin/dashboard', adminCtrl.getDashboard);

// ── Users ──
router.get('/admin/users',          adminCtrl.getUsers);
router.post('/admin/users/:id/ban', adminCtrl.toggleBan);
router.delete('/admin/users/:id',   adminCtrl.deleteUser);

// ── URLs ──
router.get('/admin/urls',        adminCtrl.getUrls);
router.delete('/admin/urls/:id', adminCtrl.deleteUrl);

module.exports = router;
