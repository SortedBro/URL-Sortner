const express = require('express');

const { requireApiKey } = require('../middleware/apiKey.middleware');
const {
    getApiAccount,
    listApiUrls,
    createApiUrl,
    getApiUrl,
    getApiUrlAnalytics,
    deleteApiUrl,
} = require('../controllers/apiControllers');

const router = express.Router();

router.use(requireApiKey);

router.get('/account', getApiAccount);
router.get('/urls', listApiUrls);
router.post('/urls', createApiUrl);
router.get('/urls/:code', getApiUrl);
router.get('/urls/:code/analytics', getApiUrlAnalytics);
router.delete('/urls/:code', deleteApiUrl);

module.exports = router;
