const RESERVED_TOP_LEVEL_PATHS = Object.freeze([
    'signup',
    'login',
    'logout',
    'about',
    'dashboard',
    'analytics',
    'pricing',
    'features',
    'privacy',
    'terms',
    'faq',
    'tools',
    'sitemap.xml',
    'verify-otp',
    'contact',
    'shorten',
    'api',
    'upgrade',
    'a',
    'affiliate',
    'admin',
    'manage',
    'wallet',
    'payout',
    'panel',
    'bulk',
    'bulk-shorten',
    'health',
    'healthz',
    'readyz',
    'brand',
    'sitemap',
    'settings',
    'internal',
    'unlock',
    'qr-codes',
]);

function isReservedTopLevelPath(value) {
    return RESERVED_TOP_LEVEL_PATHS.includes(String(value || '').toLowerCase());
}

module.exports = {
    RESERVED_TOP_LEVEL_PATHS,
    isReservedTopLevelPath,
};
