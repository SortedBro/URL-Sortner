const crypto = require('crypto');

const User = require('../models/userSchema');
const { isBusinessPlan } = require('./planFeatures');

const fetchClient = global.fetch || require('node-fetch');

const ALLOWED_WEBHOOK_EVENTS = Object.freeze([
    'link.created',
    'link.clicked',
    'link.deleted',
]);

function createWebhookSignature(secret, payload) {
    if (!secret) return '';
    return crypto.createHmac('sha256', String(secret)).update(String(payload)).digest('hex');
}

async function dispatchUserWebhook(userId, eventName, payload) {
    if (!userId || !ALLOWED_WEBHOOK_EVENTS.includes(eventName)) {
        return false;
    }

    const userDoc = await User.findById(userId).select('plan webhookSettings').lean();
    if (!userDoc || !isBusinessPlan(userDoc.plan)) {
        return false;
    }

    const settings = userDoc.webhookSettings || {};
    const enabledEvents = Array.isArray(settings.events) ? settings.events : [];
    const endpointUrl = String(settings.endpointUrl || '').trim();

    if (!settings.enabled || !endpointUrl || !enabledEvents.includes(eventName)) {
        return false;
    }

    const body = JSON.stringify({
        event: eventName,
        occurredAt: new Date().toISOString(),
        payload,
    });
    const signature = createWebhookSignature(settings.signingSecret, body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetchClient(endpointUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-snaplink-event': eventName,
                'x-snaplink-signature': signature,
            },
            body,
            signal: controller.signal,
        });

        await User.findByIdAndUpdate(userId, {
            'webhookSettings.lastTriggeredAt': new Date(),
            'webhookSettings.lastStatus': response.ok ? `ok:${response.status}` : `error:${response.status}`,
        });

        return response.ok;
    } catch (error) {
        await User.findByIdAndUpdate(userId, {
            'webhookSettings.lastTriggeredAt': new Date(),
            'webhookSettings.lastStatus': `failed:${error.name || 'request_error'}`,
        });
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    ALLOWED_WEBHOOK_EVENTS,
    createWebhookSignature,
    dispatchUserWebhook,
};
