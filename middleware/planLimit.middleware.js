const User = require('../models/userSchema');

const FREE_LIMIT = 10;

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Enforces monthly URL creation limit for free plan users.
 * Paid plans bypass this middleware.
 */
const checkPlanLimit = async (req, res, next) => {
    try {
        // Guests can still create links from homepage flow.
        if (!req.user?.user) return next();

        const user = await User.findById(req.user.user).select('plan urlsThisMonth urlsMonthYear');
        if (!user) return next();

        if (user.plan === 'pro' || user.plan === 'business') {
            return next();
        }

        const monthKey = getCurrentMonthKey();
        if (user.urlsMonthYear !== monthKey) {
            user.urlsThisMonth = 0;
            user.urlsMonthYear = monthKey;
            await user.save();
        }

        if (user.urlsThisMonth >= FREE_LIMIT) {
            req.session.error = `Free plan mein sirf ${FREE_LIMIT} URLs/month bana sakte ho. Pro plan upgrade karo!`;
            req.session.showUpgrade = true;
            const returnPath = req.body?.returnTo === 'dashboard' ? '/dashboard' : '/';
            return res.redirect(returnPath);
        }

        return next();
    } catch (error) {
        console.log('Plan limit check error:', error);
        // Fail-open to avoid blocking core URL shortening due transient DB issue.
        return next();
    }
};

/**
 * Called after successful URL creation.
 * Keeps usage counters in sync with current month.
 */
const incrementUrlCount = async (userId) => {
    try {
        if (!userId) return;

        await User.findByIdAndUpdate(userId, {
            $inc: { urlsThisMonth: 1 },
            urlsMonthYear: getCurrentMonthKey(),
        });
    } catch (error) {
        console.log('Increment URL count error:', error);
    }
};

module.exports = { checkPlanLimit, incrementUrlCount };
