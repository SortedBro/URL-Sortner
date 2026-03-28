const express = require('express');

const { softAuth, auth } = require('../middleware/auth.middleware');
const { unlockProtectedUrl } = require('../controllers/urlControllers');
const {
    getSettings,
    updateProfile,
    updatePassword,
    updateWhiteLabel,
    rotateApiKey,
    disableApiKey,
    updateWebhookSettings,
    updateWeeklyReportSettings,
    sendWeeklyReportNow,
    inviteTeamMember,
    removeTeamMember,
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
router.post('/settings/api-access/rotate', auth, rotateApiKey);
router.post('/settings/api-access/disable', auth, disableApiKey);
router.post('/settings/webhooks', auth, updateWebhookSettings);
router.post('/settings/reports/weekly', auth, updateWeeklyReportSettings);
router.post('/settings/reports/weekly/send-now', auth, sendWeeklyReportNow);
router.post('/settings/team/invite', auth, inviteTeamMember);
router.post('/settings/team/remove', auth, removeTeamMember);
router.post('/settings/white-label', auth, updateWhiteLabel);

router.post('/unlock/:code', unlockProtectedUrl);

module.exports = router;
