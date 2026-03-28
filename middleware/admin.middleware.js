const User = require('../models/userSchema');

/**
 * Admin gatekeeper middleware.
 * Should be used after `auth` middleware so `req.user` is available.
 */
const adminAuth = async (req, res, next) => {
    try {
        if (!req.user?.user) {
            return res.redirect('/login');
        }

        const user = await User.findById(req.user.user).select('role');
        if (!user || user.role !== 'admin') {
            return res.status(403).render('404');
        }

        req.adminUser = user;
        return next();
    } catch (error) {
        console.log('Admin auth error:', error);
        return res.redirect('/login');
    }
};

module.exports = { adminAuth };
