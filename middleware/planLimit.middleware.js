const User = require('../models/userSchema');

const FREE_LIMIT = 10;

const checkPlanLimit = async (req, res, next) => {
    try {
        // ✅ Login nahi hai — guest user, allow karo (logged out bhi URL bana sakta)
        if (!req.user) return next();
         console.log('=== FREE USER DEBUG ===');
        console.log('req.user:', req.user);
        
       
       

        const user = await User.findById(req.user.user);
         console.log('DB Plan:', user?.plan);
        console.log('urlsThisMonth:', user?.urlsThisMonth);
        console.log('======================');
        if (!user) return next();

        // ✅ Pro/Business user — koi limit nahi
        if (user.plan === 'pro' || user.plan === 'business') {
            return next();
        }

        // ✅ Current month check karo — "2026-03" format
        const now = new Date();
        const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // ✅ Naya mahina aa gaya — reset karo
        if (user.urlsMonthYear !== currentMonthYear) {
            user.urlsThisMonth = 0;
            user.urlsMonthYear = currentMonthYear;
            await user.save();
        }

        // ✅ Limit check
        if (user.urlsThisMonth >= FREE_LIMIT) {
            // Session mein error save karo
            req.session.error = `Free plan mein sirf ${FREE_LIMIT} URLs/month bana sakte ho. Pro plan upgrade karo!`;
            req.session.showUpgrade = true; // upgrade modal dikhane ke liye
            const returnPath = req.body?.returnTo === 'dashboard' ? '/dashboard' : '/';
            return res.redirect(returnPath);
        }

        // ✅ Count badhao — URL banana allow karo
        req.user.planData = user; // controller mein use karne ke liye
        next();

    } catch (error) {
        console.log('Plan limit check error:', error);
        next(); // error pe bhi allow karo
    }
};

// ✅ URL create hone ke baad count badhao
const incrementUrlCount = async (userId) => {
    try {
        if (!userId) return;

        const now = new Date();
        const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        await User.findByIdAndUpdate(userId, {
            $inc: { urlsThisMonth: 1 },
            urlsMonthYear: currentMonthYear,
        });
    } catch (error) {
        console.log('Increment URL count error:', error);
    }
};

module.exports = { checkPlanLimit, incrementUrlCount };
