const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    getBrandDashboard,
    submitCampaign,
    deleteCampaign
} = require('../controllers/brandControllers');

router.get('/dashboard', auth, getBrandDashboard);
router.post('/submit', auth, submitCampaign);
router.post('/delete/:id', auth, deleteCampaign);

module.exports = router;