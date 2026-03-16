const express = require('express');
const router = express.Router();

const { getDashboard, } = require('../controllers/dboardControllers');
const { deleteUrl, getAnalytics } = require('../controllers/urlControllers');
const { auth, softAuth } = require('../middleware/auth.middleware');

const tasks = [
    { label: "Dashboard UI",   state: "wip"  },
    { label: "URL Analytics",  state: "todo" },
    { label: "Pricing page",   state: "todo" },
    { label: "Auth & JWT",     state: "done" },
    { label: "Terms of Service", state: "todo" },
    { label: "Privacy Policy", state: "todo" }
];

// ── Dashboard ──
router.get('/dashboard',         auth,     getDashboard);
router.get('/analytics/:code',   auth,     getAnalytics);
router.post('/delete/:code',     auth,     deleteUrl);

// ── Pricing ──
router.get('/pricing', softAuth, (req, res) => {
    res.render('pricing', { user: req.user });
});

// ── Under Development Pages ──
router.get('/features', softAuth, (req, res) => {
    res.render('under-dev', { pageTitle: 'Features',        tasks, body: '' });
});
router.get('/privacy',  softAuth, (req, res) => {
    res.render('under-dev', { pageTitle: 'Privacy Policy',  tasks, body: '' });
});
router.get('/terms',    softAuth, (req, res) => {
    res.render('under-dev', { pageTitle: 'Terms of Service', tasks, body: '' });
});

module.exports = router;
