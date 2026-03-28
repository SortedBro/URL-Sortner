const express = require('express');

const { getDashboard } = require('../controllers/dboardControllers');
const { deleteUrl, getAnalytics } = require('../controllers/urlControllers');
const { auth, softAuth } = require('../middleware/auth.middleware');
const Url = require('../models/urlSchema');

const router = express.Router();

const tasks = [
    { label: 'Dashboard UI', state: 'wip' },
    { label: 'URL Analytics', state: 'todo' },
    { label: 'Pricing page', state: 'todo' },
    { label: 'Auth & JWT', state: 'done' },
    { label: 'Terms of Service', state: 'todo' },
    { label: 'Privacy Policy', state: 'todo' },
];

router.get('/dashboard', auth, getDashboard);
router.get('/analytics/:code', auth, getAnalytics);
router.post('/delete/:code', auth, deleteUrl);
router.get('/qr-codes', auth, async (req, res) => {
    try {
        const urls = await Url.find({ createdBy: req.user.user }).sort({ createdAt: -1 });
        return res.render('qrcodes', { urls, user: req.user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/pricing', softAuth, (req, res) => {
    res.render('pricing', { user: req.user });
});

router.get('/features', softAuth, (req, res) => {
    res.render('features', { user: req.user || null });
});

router.get('/privacy', softAuth, (req, res) => {
    res.render('under-dev', { pageTitle: 'Privacy Policy', tasks, body: '' });
});

router.get('/terms', softAuth, (req, res) => {
    res.render('under-dev', { pageTitle: 'Terms of Service', tasks, body: '' });
});

module.exports = router;
