const express = require('express');

const { auth } = require('../middleware/auth.middleware');
const {
    createLink,
    trackAndRedirect,
    getDashboard,
    getLinkAnalytics,
    deleteLink,
} = require('../controllers/affiliateControllers');

const router = express.Router();

router.get('/', auth, (req, res) => res.redirect('/affiliate/dashboard'));

// Canonical production routes
router.get('/dashboard', auth, getDashboard);
router.post('/links', auth, createLink);
router.get('/links/:code/analytics', auth, getLinkAnalytics);
router.post('/links/:code/delete', auth, deleteLink);

// Backward-compatible aliases
router.get('/analytics/:code', auth, getLinkAnalytics);
router.post('/create', auth, createLink);
router.post('/delete/:code', auth, deleteLink);
router.get('/:code', trackAndRedirect);

module.exports = router;
