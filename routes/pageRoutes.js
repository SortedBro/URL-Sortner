const express = require('express');

const { softAuth, auth } = require('../middleware/auth.middleware');
const { unlockProtectedUrl } = require('../controllers/urlControllers');
const {
    getSettings,
    updateProfile,
    updatePassword,
    updateWhiteLabel,
} = require('../controllers/settingsControllers');

const router = express.Router();

router.get('/', softAuth, (req, res) => {
    const shortUrl = req.session.shortUrl || null;
    const error = req.session.error || null;
    req.session.shortUrl = null;
    req.session.error = null;
    res.render('home', { shortUrl, error, user: req.user });
});

router.get('/tools', softAuth, (req, res) => {
    const shortUrl = req.session.shortUrl || null;
    const error = req.session.error || null;
    req.session.shortUrl = null;
    req.session.error = null;
    res.render('tools', { user: req.user || null, shortUrl, error });
});

router.get('/settings', auth, getSettings);
router.post('/settings/profile', auth, updateProfile);
router.post('/settings/password', auth, updatePassword);
router.post('/settings/white-label', auth, updateWhiteLabel);

router.post('/unlock/:code', unlockProtectedUrl);

module.exports = router;
