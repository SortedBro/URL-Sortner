const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    getBrandDashboard,
    submitCampaign,
    deleteCampaign
} = require('../controllers/brandControllers');

router.get('/', auth, (req, res) => res.redirect('/brand/campaigns'));

// Canonical production routes
router.get('/campaigns', auth, getBrandDashboard);
router.post('/campaigns', auth, submitCampaign);
router.post('/campaigns/:id/delete', auth, deleteCampaign);

// Backward-compatible aliases
router.get('/dashboard', auth, (req, res) => res.redirect('/brand/campaigns'));
router.post('/submit', auth, submitCampaign);
router.post('/delete/:id', auth, deleteCampaign);

module.exports = router;
