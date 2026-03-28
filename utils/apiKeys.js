const crypto = require('crypto');

const API_KEY_PREFIX = 'snap_live_';

function generateApiKey() {
    return `${API_KEY_PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}

function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(String(apiKey || '')).digest('hex');
}

function buildApiKeyPreview(apiKey) {
    const normalized = String(apiKey || '').trim();
    if (!normalized) return '';
    return `${normalized.slice(0, 14)}...${normalized.slice(-6)}`;
}

module.exports = {
    API_KEY_PREFIX,
    generateApiKey,
    hashApiKey,
    buildApiKeyPreview,
};
