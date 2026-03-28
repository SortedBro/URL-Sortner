const User = require('../models/userSchema');
const { REFRESH_COOKIE_NAME, clearAuthCookie, verifyAuthToken } = require('../utils/authToken');

/**
 * Hard-auth middleware.
 * - Requires a valid auth cookie.
 * - Loads the user from DB to enforce ban/deleted-user checks.
 * - Redirects to login for browser routes.
 */
exports.auth = async (req, res, next) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = verifyAuthToken(token);
        const user = await User.findById(decoded.user).select('isBanned');

        if (!user) {
            clearAuthCookie(res);
            return res.redirect('/login');
        }

        if (user.isBanned) {
            clearAuthCookie(res);
            return res.redirect('/login?banned=true');
        }

        req.user = decoded;
        return next();
    } catch (error) {
        // Token expired/invalid => clear and force fresh login.
        clearAuthCookie(res);
        return res.redirect('/login');
    }
};

/**
 * Soft-auth middleware.
 * - Never blocks route access.
 * - If token exists and is valid, attaches `req.user`.
 * - If invalid token is present, clears it and continues as guest.
 */
exports.softAuth = (req, res, next) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        req.user = verifyAuthToken(token);
        return next();
    } catch (error) {
        clearAuthCookie(res);
        req.user = null;
        return next();
    }
};
