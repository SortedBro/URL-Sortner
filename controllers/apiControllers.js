const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

const Url = require('../models/urlSchema');
const User = require('../models/userSchema');
const { appConfig } = require('../config/appConfig');
const { RESERVED_TOP_LEVEL_PATHS } = require('../config/reservedPaths');
const { isBusinessPlan } = require('../utils/planFeatures');
const { dispatchUserWebhook } = require('../utils/webhooks');
const { buildAnalyticsSummary } = require('./urlControllers');

const RESERVED_CODES = new Set(RESERVED_TOP_LEVEL_PATHS);
const SHORT_CODE_LENGTH = 6;
const MAX_SHORT_CODE_ATTEMPTS = 8;
const API_LIST_LIMIT = 100;

function jsonError(res, statusCode, message, details) {
    return res.status(statusCode).json({
        ok: false,
        message,
        ...(details ? { details } : {}),
    });
}

function normalizeDomain(input = '') {
    if (!input) return '';
    return String(input)
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*/, '');
}

function isValidDomain(domain) {
    if (!domain) return false;
    return /^(?=.{3,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain);
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function generateUniqueShortCode() {
    for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt += 1) {
        const candidate = nanoid(SHORT_CODE_LENGTH).toLowerCase();
        const exists = await Url.exists({ shortCode: candidate });
        if (!exists) return candidate;
    }

    return nanoid(SHORT_CODE_LENGTH + 2).toLowerCase();
}

function buildUrlResponse(urlDoc) {
    return {
        id: String(urlDoc._id),
        shortCode: urlDoc.shortCode,
        shortUrl: urlDoc.shortUrl,
        originalUrl: urlDoc.orginalUrl,
        clicks: Number(urlDoc.clicks || 0),
        customAlias: urlDoc.customAlias || '',
        hasPassword: Boolean(urlDoc.hasPassword),
        expiresAt: urlDoc.expiresAt || null,
        whiteLabelDomain: urlDoc.whiteLabelDomain || '',
        refParam: urlDoc.refParam || '',
        createdAt: urlDoc.createdAt,
        updatedAt: urlDoc.updatedAt,
    };
}

exports.getApiAccount = async (req, res) => {
    return res.json({
        ok: true,
        account: {
            id: String(req.apiUser.user),
            name: req.apiUser.name,
            email: req.apiUser.email,
            plan: req.apiUser.plan,
        },
        capabilities: {
            apiAccess: true,
            webhooks: isBusinessPlan(req.apiUser.plan),
            teamWorkspace: isBusinessPlan(req.apiUser.plan),
            whiteLabel: isBusinessPlan(req.apiUser.plan),
        },
    });
};

exports.listApiUrls = async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), API_LIST_LIMIT);
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            Url.find({ createdBy: req.apiUser.user })
                .select('shortCode shortUrl orginalUrl clicks customAlias hasPassword expiresAt whiteLabelDomain refParam createdAt updatedAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Url.countDocuments({ createdBy: req.apiUser.user }),
        ]);

        return res.json({
            ok: true,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1),
            },
            items: items.map(buildUrlResponse),
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 500, 'Unable to load API URLs');
    }
};

exports.createApiUrl = async (req, res) => {
    try {
        const originalUrl = String(req.body.originalUrl || req.body.orginalUrl || '').trim();
        const customAlias = String(req.body.customAlias || '').trim().toLowerCase();
        const password = String(req.body.password || '').trim();
        const refParam = String(req.body.refParam || '').trim();
        const expiresAtValue = String(req.body.expiresAt || '').trim();

        if (!originalUrl) {
            return jsonError(res, 400, 'originalUrl is required');
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(originalUrl);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('invalid_protocol');
            }
        } catch {
            return jsonError(res, 400, 'originalUrl must be a valid absolute URL');
        }

        const ownHost = req.get('host');
        if (parsedUrl.host === ownHost) {
            return jsonError(res, 400, 'You cannot shorten this application URL');
        }

        if (customAlias) {
            if (!/^[a-zA-Z0-9_-]{3,40}$/.test(customAlias)) {
                return jsonError(res, 400, 'customAlias allows only letters, numbers, dash, and underscore');
            }

            if (RESERVED_CODES.has(customAlias)) {
                return jsonError(res, 400, 'customAlias is reserved');
            }

            const aliasExists =
                (await Url.exists({ shortCode: customAlias })) ||
                (await Url.exists({
                    shortCode: new RegExp(`^${escapeRegex(customAlias)}$`, 'i'),
                }));
            if (aliasExists) {
                return jsonError(res, 409, 'customAlias is already in use');
            }
        }

        let expiresAt = null;
        if (expiresAtValue) {
            expiresAt = new Date(expiresAtValue);
            if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
                return jsonError(res, 400, 'expiresAt must be a future date');
            }
        }

        let passwordHash = '';
        if (password) {
            if (password.length < 4) {
                return jsonError(res, 400, 'password must be at least 4 characters');
            }
            passwordHash = await bcrypt.hash(password, 10);
        }

        const userDoc = await User.findById(req.apiUser.user).select('plan whiteLabel');
        if (!userDoc) {
            return jsonError(res, 404, 'User not found');
        }

        let whiteLabelDomain = normalizeDomain(req.body.whiteLabelDomain || '');
        if (!whiteLabelDomain && isBusinessPlan(userDoc.plan) && userDoc.whiteLabel?.enabled) {
            whiteLabelDomain = normalizeDomain(userDoc.whiteLabel.customDomain);
        }

        if (whiteLabelDomain) {
            if (!isBusinessPlan(userDoc.plan)) {
                return jsonError(res, 403, 'whiteLabelDomain requires the Business plan');
            }

            if (!userDoc.whiteLabel?.enabled) {
                return jsonError(res, 403, 'Enable white-label in settings before using a custom domain');
            }

            if (normalizeDomain(userDoc.whiteLabel.customDomain) !== whiteLabelDomain) {
                return jsonError(res, 400, 'whiteLabelDomain must match the configured business domain');
            }

            if (!isValidDomain(whiteLabelDomain)) {
                return jsonError(res, 400, 'whiteLabelDomain is not valid');
            }
        }

        const shortCode = customAlias || (await generateUniqueShortCode());
        const appBaseUrl = appConfig.appUrl || `${req.protocol}://${req.get('host')}`;
        const publicBaseUrl = whiteLabelDomain ? `https://${whiteLabelDomain}` : appBaseUrl;

        const createdUrl = await Url.create({
            orginalUrl: originalUrl,
            shortCode,
            shortUrl: `${publicBaseUrl}/${shortCode}`,
            customAlias,
            createdBy: req.apiUser.user,
            expiresAt: expiresAt || undefined,
            hasPassword: Boolean(passwordHash),
            accessPasswordHash: passwordHash,
            whiteLabelDomain,
            refParam: refParam || null,
        });

        setImmediate(() => {
            dispatchUserWebhook(req.apiUser.user, 'link.created', {
                shortCode: createdUrl.shortCode,
                shortUrl: createdUrl.shortUrl,
                originalUrl,
            }).catch(console.error);
        });

        return res.status(201).json({
            ok: true,
            item: buildUrlResponse(createdUrl),
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 500, 'Unable to create short URL');
    }
};

exports.getApiUrl = async (req, res) => {
    try {
        const urlDoc = await Url.findOne({
            createdBy: req.apiUser.user,
            shortCode: String(req.params.code || '').trim().toLowerCase(),
        })
            .select('shortCode shortUrl orginalUrl clicks customAlias hasPassword expiresAt whiteLabelDomain refParam createdAt updatedAt lastClickedAt')
            .lean();

        if (!urlDoc) {
            return jsonError(res, 404, 'URL not found');
        }

        return res.json({
            ok: true,
            item: {
                ...buildUrlResponse(urlDoc),
                lastClickedAt: urlDoc.lastClickedAt || null,
            },
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 500, 'Unable to load URL');
    }
};

exports.getApiUrlAnalytics = async (req, res) => {
    try {
        const urlDoc = await Url.findOne({
            createdBy: req.apiUser.user,
            shortCode: String(req.params.code || '').trim().toLowerCase(),
        })
            .select(
                'shortCode shortUrl orginalUrl clicks customAlias hasPassword expiresAt whiteLabelDomain refParam createdAt updatedAt lastClickedAt clickHistory'
            )
            .lean();

        if (!urlDoc) {
            return jsonError(res, 404, 'URL not found');
        }

        const clickHistory = Array.isArray(urlDoc.clickHistory) ? urlDoc.clickHistory : [];
        return res.json({
            ok: true,
            item: buildUrlResponse(urlDoc),
            analytics: {
                totalClicks: Number(urlDoc.clicks || 0),
                lastClickedAt: urlDoc.lastClickedAt || null,
                summary: buildAnalyticsSummary(clickHistory),
                recentClicks: clickHistory.slice(-25).reverse(),
            },
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 500, 'Unable to load analytics');
    }
};

exports.deleteApiUrl = async (req, res) => {
    try {
        const urlDoc = await Url.findOne({
            createdBy: req.apiUser.user,
            shortCode: String(req.params.code || '').trim().toLowerCase(),
        });

        if (!urlDoc) {
            return jsonError(res, 404, 'URL not found');
        }

        const payload = {
            shortCode: urlDoc.shortCode,
            shortUrl: urlDoc.shortUrl,
            originalUrl: urlDoc.orginalUrl,
        };

        await urlDoc.deleteOne();

        setImmediate(() => {
            dispatchUserWebhook(req.apiUser.user, 'link.deleted', payload).catch(console.error);
        });

        return res.json({
            ok: true,
            message: 'URL deleted',
        });
    } catch (error) {
        console.error(error);
        return jsonError(res, 500, 'Unable to delete URL');
    }
};
