const Url = require('../models/urlSchema');
const User = require('../models/userSchema');
const { isBusinessPlan } = require('./planFeatures');
const { sendWeeklyReportEmail } = require('./reportMailer');

const REPORT_WEEKDAYS = Object.freeze([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
]);

function getWeekdayName(date = new Date()) {
    return REPORT_WEEKDAYS[(date.getDay() + 6) % 7];
}

async function buildWeeklyReport(userId) {
    const urls = await Url.find({ createdBy: userId })
        .select('shortCode shortUrl clicks createdAt lastClickedAt')
        .sort({ clicks: -1, createdAt: -1 })
        .lean();

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const totalLinks = urls.length;
    const totalClicks = urls.reduce((sum, url) => sum + Number(url.clicks || 0), 0);
    const newLinksThisWeek = urls.filter((url) => url.createdAt && new Date(url.createdAt) >= weekStart).length;
    const topLinks = urls.slice(0, 5).map((url) => ({
        shortCode: url.shortCode,
        shortUrl: url.shortUrl,
        clicks: Number(url.clicks || 0),
    }));

    return {
        totalLinks,
        totalClicks,
        newLinksThisWeek,
        topLinks,
    };
}

async function sendWeeklyReportForUser(userDoc) {
    if (!userDoc || !isBusinessPlan(userDoc.plan)) {
        return { sent: false, reason: 'plan_not_eligible' };
    }

    const settings = userDoc.weeklyReportSettings || {};
    const recipientEmail = String(settings.recipientEmail || userDoc.email || '').trim().toLowerCase();
    if (!recipientEmail) {
        return { sent: false, reason: 'recipient_missing' };
    }

    const report = await buildWeeklyReport(userDoc._id);
    await sendWeeklyReportEmail({
        to: recipientEmail,
        name: userDoc.firstName,
        report,
    });

    await User.findByIdAndUpdate(userDoc._id, {
        'weeklyReportSettings.lastSentAt': new Date(),
    });

    return {
        sent: true,
        report,
    };
}

async function runWeeklyReportsForWeekday(weekday = getWeekdayName()) {
    const normalizedWeekday = REPORT_WEEKDAYS.includes(String(weekday || '').toLowerCase())
        ? String(weekday).toLowerCase()
        : getWeekdayName();

    const users = await User.find({
        plan: 'business',
        'weeklyReportSettings.enabled': true,
        'weeklyReportSettings.weekday': normalizedWeekday,
    }).select('firstName email plan weeklyReportSettings');

    const results = [];

    for (const userDoc of users) {
        try {
            const result = await sendWeeklyReportForUser(userDoc);
            results.push({
                userId: String(userDoc._id),
                email: userDoc.email,
                ...result,
            });
        } catch (error) {
            results.push({
                userId: String(userDoc._id),
                email: userDoc.email,
                sent: false,
                reason: error.message || 'send_failed',
            });
        }
    }

    return {
        weekday: normalizedWeekday,
        totalUsers: users.length,
        sentCount: results.filter((item) => item.sent).length,
        results,
    };
}

module.exports = {
    REPORT_WEEKDAYS,
    getWeekdayName,
    buildWeeklyReport,
    sendWeeklyReportForUser,
    runWeeklyReportsForWeekday,
};
