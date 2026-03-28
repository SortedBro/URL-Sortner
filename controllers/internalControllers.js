const { appConfig } = require('../config/appConfig');
const { getWeekdayName, runWeeklyReportsForWeekday } = require('../utils/weeklyReports');

function jsonError(res, statusCode, message) {
    return res.status(statusCode).json({
        ok: false,
        message,
    });
}

exports.runWeeklyReportsJob = async (req, res) => {
    try {
        if (!appConfig.internalJobSecret) {
            return jsonError(res, 503, 'INTERNAL_JOB_SECRET is not configured');
        }

        const providedSecret = String(req.headers['x-job-secret'] || '').trim();
        if (!providedSecret || providedSecret !== appConfig.internalJobSecret) {
            return jsonError(res, 401, 'Invalid job secret');
        }

        const requestedWeekday = String(req.body.weekday || '').trim().toLowerCase();
        const result = await runWeeklyReportsForWeekday(requestedWeekday || getWeekdayName());

        return res.json({
            ok: true,
            ...result,
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 500, 'Weekly report job failed');
    }
};
