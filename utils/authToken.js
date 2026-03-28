const jwt = require('jsonwebtoken');
const { appConfig } = require('../config/appConfig');

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_TOKEN_TTL = '10h';

/**
 * Builds the token payload expected across the app.
 */
function buildAuthPayload(userDoc) {
    return {
        user: userDoc._id,
        name: userDoc.firstName,
        plan: userDoc.plan,
        role: userDoc.role,
    };
}

function signAuthToken(payload) {
    return jwt.sign(payload, appConfig.jwtSecret, { expiresIn: REFRESH_TOKEN_TTL });
}

function verifyAuthToken(token) {
    return jwt.verify(token, appConfig.jwtSecret);
}

function attachAuthCookie(res, token) {
    res.cookie(REFRESH_COOKIE_NAME, String(token).trim(), {
        httpOnly: true,
        secure: appConfig.isProduction,
        sameSite: 'lax',
    });
}

function issueAuthCookie(res, userDoc) {
    const token = signAuthToken(buildAuthPayload(userDoc));
    attachAuthCookie(res, token);
    return token;
}

function clearAuthCookie(res) {
    res.clearCookie(REFRESH_COOKIE_NAME);
}

module.exports = {
    REFRESH_COOKIE_NAME,
    buildAuthPayload,
    signAuthToken,
    verifyAuthToken,
    attachAuthCookie,
    issueAuthCookie,
    clearAuthCookie,
};
