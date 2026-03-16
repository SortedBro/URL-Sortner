const User = require('../models/userSchema');

// ✅ Admin middleware — sirf admin access kar sakta hai
const adminAuth = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }

        const user = await User.findById(req.user.user);

        if (!user || user.role !== 'admin') {
            return res.status(403).render('404'); // unauthorized
        }

        req.adminUser = user;
        next();

    } catch (error) {
        console.log('Admin auth error:', error);
        res.redirect('/login');
    }
};

module.exports = { adminAuth };