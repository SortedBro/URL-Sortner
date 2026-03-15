// routes/dashboard.js ya jahan bhi chahiye

const express = require('express');
const { getDashboard } = require('../controllers/dboardControllers');
const { auth } = require('../middleware/auth.middleware');
const { deleteUrl } = require('../controllers/urlControllers');


const router = express.Router();

const tasks = [
    { label: "Dashboard UI", state: "wip" },
    { label: "URL Analytics", state: "todo" },
    { label: "Pricing page", state: "todo" },
    { label: "Auth & JWT", state: "done" },
    { label: "Terms of Service", state: "todo" },
    { label: "Privacy Policy", state: "todo" }
];


router.post('/delete/:code',auth,deleteUrl)

router.get('/dashboard',auth, getDashboard);

router.get('/pricing', (req, res) => {
    res.render('under-dev', {
        pageTitle: 'Pricing',
        tasks: tasks,
        body: ''
    });
});
router.get('/features', (req, res) => {
    res.render('under-dev', {
        pageTitle: 'Pricing',
        tasks: tasks,
        body: ''
    });
});
router.get('/privacy', (req, res) => {
    res.render('under-dev', {
        pageTitle: 'Pricing',
        tasks: tasks,
        body: ''
    });
});
router.get('/terms', (req, res) => {
    res.render('under-dev', {
        pageTitle: 'Pricing',
        tasks: tasks,
        body: ''
    });
});

module.exports = router;