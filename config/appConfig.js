require('dotenv').config();
const packageJson = require('../package.json');

/**
 * Central application configuration.
 *
 * Why this exists:
 * - Keeps env parsing in one place.
 * - Makes startup fail fast for missing critical config in production.
 * - Reduces "magic strings" spread across controllers/middlewares.
 */
const isProduction = process.env.NODE_ENV === 'production';
const assetVersion =
    process.env.ASSET_VERSION ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    packageJson.version ||
    'dev';

const appConfig = Object.freeze({
    env: process.env.NODE_ENV || 'development',
    isProduction,
    assetVersion: String(assetVersion).slice(0, 20),
    port: Number(process.env.PORT || 3000),
    appUrl: process.env.APP_URL || '',
    jwtSecret: process.env.jwt_secret || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    mongoUri: process.env.MONGODB_URI || '',
    redisUrl: process.env.REDIS_URL || '',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    internalJobSecret: process.env.INTERNAL_JOB_SECRET || '',
    monetagZoneId: process.env.MONETAG_ZONE_ID || '10810328',
    monetagScriptUrl: 'https://al5sm.com/tag.min.js',
    resendApiKey:
        process.env.RESEND_API_KEY ||
        process.env.RESEND_KEY ||
        process.env.RESEND_KEY_ID ||
        '',
});

/**
 * Enforces minimum config requirements.
 * In development we allow some fallback behavior for smoother local setup.
 */
function validateCriticalConfig() {
    const problems = [];

    if (!appConfig.mongoUri) problems.push('MONGODB_URI is missing');
    if (!appConfig.jwtSecret) problems.push('jwt_secret is missing');

    if (appConfig.isProduction) {
        if (!appConfig.sessionSecret || appConfig.sessionSecret.length < 32) {
            problems.push('SESSION_SECRET must be at least 32 characters in production');
        }
    }

    if (problems.length) {
        const message = `Configuration error:\n- ${problems.join('\n- ')}`;
        throw new Error(message);
    }
}

module.exports = {
    appConfig,
    validateCriticalConfig,
};
