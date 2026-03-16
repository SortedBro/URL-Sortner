// routes/dashboard.js ya jahan bhi chahiye

const express = require('express');
const { getDashboard } = require('../controllers/dboardControllers');
const { auth, softAuth } = require('../middleware/auth.middleware');
const { deleteUrl } = require('../controllers/urlControllers');
const { getAnalytics } = require('../controllers/urlControllers');

const router = express.Router();

const tasks = [
    { label: "Dashboard UI", state: "wip" },
    { label: "URL Analytics", state: "todo" },
    { label: "Pricing page", state: "todo" },
    { label: "Auth & JWT", state: "done" },
    { label: "Terms of Service", state: "todo" },
    { label: "Privacy Policy", state: "todo" }
];


router.post('/delete/:code', auth, deleteUrl)

router.get('/dashboard', auth, getDashboard);
router.get('/analytics/:code', auth, getAnalytics);

router.get('/pricing', softAuth, (req, res) => {
    res.render('pricing', {
        user: req.user,
    });
});
router.get('/features', softAuth, (req, res) => {
    res.render('under-dev', {
        pageTitle: 'Pricing',
        tasks: tasks,
        body: ''
    });
});
router.get('/privacy', softAuth, (req, res) => {
    res.render('under-dev', {
        pageTitle: 'Pricing',
        tasks: tasks,
        body: ''
    });
});
router.get('/terms', softAuth, (req, res) => {
    res.render('under-dev', {
        pageTitle: 'Pricing',
        tasks: tasks,
        body: ''
    });
});

module.exports = router;