const User = require('../models/userSchema');
const { hashApiKey } = require('../utils/apiKeys');
const { isProPlan } = require('../utils/planFeatures');

function jsonError(res, statusCode, message) {
    return res.status(statusCode).json({
        ok: false,
        message,
    });
}

function extractApiKey(req) {
    const headerKey = String(req.headers['x-api-key'] || '').trim();
    if (headerKey) return headerKey;

    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    return '';
}

/**
 * Protects production API routes with a user-owned API key.
 * We intentionally keep this separate from cookie auth so external tools
 * can integrate without browser sessions.
 */
exports.requireApiKey = async (req, res, next) => {
    try {
        const apiKey = extractApiKey(req);
        if (!apiKey) {
            return jsonError(res, 401, 'API key missing');
        }

        const keyHash = hashApiKey(apiKey);
        const user = await User.findOne({
            'apiAccess.enabled': true,
            'apiAccess.keyHash': keyHash,
        }).select('firstName lastName email plan role isBanned apiAccess');

        if (!user) {
            return jsonError(res, 401, 'Invalid API key');
        }

        if (user.isBanned) {
            return jsonError(res, 403, 'Account is disabled');
        }

        if (!isProPlan(user.plan)) {
            return jsonError(res, 403, 'Current plan does not include API access');
        }

        req.apiUser = {
            user: user._id,
            plan: user.plan,
            role: user.role,
            email: user.email,
            name: `${user.firstName || ''}${user.lastName ? ` ${user.lastName}` : ''}`.trim(),
        };

        User.findByIdAndUpdate(user._id, {
            'apiAccess.lastUsedAt': new Date(),
        }).catch((error) => {
            console.warn('API key usage timestamp update failed:', error.message);
        });

        return next();
    } catch (error) {
        console.error('API auth failed:', error);
        return jsonError(res, 500, 'Unable to validate API key');
    }
};
