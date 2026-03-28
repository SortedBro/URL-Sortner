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

router.get('/dashboard', auth, getDashboard);
router.get('/analytics/:code', auth, getLinkAnalytics);
router.post('/create', auth, createLink);
router.post('/delete/:code', auth, deleteLink);
router.get('/:code', trackAndRedirect);

module.exports = router;
