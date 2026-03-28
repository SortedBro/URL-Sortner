const rateLimit = require('express-rate-limit');

/**
 * Generic helper to keep limiter setup consistent.
 */
function buildLimiter({ windowMs, max, message }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: message },
    });
}

// Login/signup endpoints: prevent brute-force attacks.
const authRateLimit = buildLimiter({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: 'Too many auth attempts. Try again in a few minutes.',
});

// URL shortening: prevent abuse/spam bursts.
const shortenRateLimit = buildLimiter({
    windowMs: 60 * 1000,
    max: 40,
    message: 'Too many shorten requests. Please slow down.',
});

// Contact form: prevent spam submissions.
const contactRateLimit = buildLimiter({
    windowMs: 10 * 60 * 1000,
    max: 15,
    message: 'Too many contact requests. Please try later.',
});

module.exports = {
    authRateLimit,
    shortenRateLimit,
    contactRateLimit,
};
