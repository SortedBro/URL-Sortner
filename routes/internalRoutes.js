const express = require('express');

const { runWeeklyReportsJob } = require('../controllers/internalControllers');

const router = express.Router();

router.post('/jobs/weekly-reports', runWeeklyReportsJob);

module.exports = router;
