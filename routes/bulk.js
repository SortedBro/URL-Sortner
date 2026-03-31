const express = require('express');
const { nanoid } = require('nanoid');

const { appConfig } = require('../config/appConfig');
const { buildAnalyticsSummary } = require('../controllers/urlControllers');
const { auth } = require('../middleware/auth.middleware');
const Url = require('../models/urlSchema');
const User = require('../models/userSchema');
const { cacheRedirectUrl, invalidateRedirectUrlCaches } = require('../utils/urlCache');
const { invalidateAdminDashboardCache, invalidateAllUserReadCaches } = require('../utils/readCache');

const router = express.Router();

const BULK_LIMIT = 500;
const BULK_TAB_REDIRECT = '/dashboard?tab=bulk';
const BULK_FEATURE_LOCK_MESSAGE = 'Bulk operations Pro/Business plan mein available hain';

function redirectToBulkTab(res) {
    return res.redirect(BULK_TAB_REDIRECT);
}

function setSessionField(session, key, value) {
    if (!session) return;
    session[key] = value;
}

function resetBulkSessionState(session) {
    if (!session) return;

    [
        'bulkResults',
        'bulkErrors',
        'bulkUpdateResults',
        'bulkUpdateErrors',
        'bulkDeleteResults',
        'bulkDeleteErrors',
    ].forEach((key) => {
        session[key] = null;
    });
}

async function loadBulkUser(userId) {
    return User.findById(userId).select('plan');
}

async function ensureBulkAccess(req, res) {
    const user = await loadBulkUser(req.user.user);
    if (!user) {
        res.redirect('/login');
        return null;
    }

    if (user.plan === 'free') {
        req.session.error = BULK_FEATURE_LOCK_MESSAGE;
        redirectToBulkTab(res);
        return null;
    }

    return user;
}

function splitBulkLines(rawInput) {
    return String(rawInput || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, BULK_LIMIT);
}

function getPublicBaseUrl(req) {
    return String(appConfig.appUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function getUniqueShortCodeCandidate() {
    return nanoid(6).toLowerCase();
}

async function getUniqueShortCode() {
    for (let i = 0; i < 10; i += 1) {
        const candidate = getUniqueShortCodeCandidate();
        const exists = await Url.exists({ shortCode: candidate });
        if (!exists) return candidate;
    }

    return null;
}

function normalizeShortCode(input = '') {
    const value = String(input || '').trim();
    if (!value) return '';

    try {
        const parsedUrl = new URL(value);
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        return String(pathParts[pathParts.length - 1] || '').trim().toLowerCase();
    } catch {
        return value.replace(/^\/+/, '').trim().toLowerCase();
    }
}

function isLikelyHeaderRow(value = '') {
    return /short\s*code|short\s*url|original\s*url|delete|update/i.test(String(value || ''));
}

function splitFirstMatch(line, delimiters) {
    for (const delimiter of delimiters) {
        const index = line.indexOf(delimiter);
        if (index > -1) {
            return [
                line.slice(0, index).trim(),
                line.slice(index + delimiter.length).trim(),
            ];
        }
    }

    const whitespaceSplit = line.split(/\s+/);
    if (whitespaceSplit.length >= 2) {
        return [whitespaceSplit[0].trim(), line.slice(whitespaceSplit[0].length).trim()];
    }

    return ['', ''];
}

function parseBulkUpdateEntries(rawInput) {
    const lines = splitBulkLines(rawInput);
    const entries = [];
    const errors = [];
    const seenCodes = new Set();

    lines.forEach((line) => {
        if (isLikelyHeaderRow(line)) {
            return;
        }

        const [codeRaw, originalUrl] = splitFirstMatch(line, [',', '\t', '|']);
        const shortCode = normalizeShortCode(codeRaw);

        if (!shortCode || !originalUrl) {
            errors.push({
                entry: line,
                reason: 'Format `shortCode,https://example.com` mein daalo',
            });
            return;
        }

        if (seenCodes.has(shortCode)) {
            errors.push({
                entry: line,
                reason: 'Duplicate short code same batch mein allowed nahi hai',
            });
            return;
        }

        try {
            new URL(originalUrl);
        } catch {
            errors.push({
                entry: line,
                reason: 'Valid destination URL do',
            });
            return;
        }

        seenCodes.add(shortCode);
        entries.push({
            shortCode,
            originalUrl,
            rawEntry: line,
        });
    });

    return { entries, errors };
}

function parseBulkDeleteEntries(rawInput) {
    const lines = splitBulkLines(rawInput);
    const entries = [];
    const errors = [];
    const seenCodes = new Set();

    lines.forEach((line) => {
        if (isLikelyHeaderRow(line)) {
            return;
        }

        const shortCode = normalizeShortCode(line.split(/[,\t|]/)[0] || '');

        if (!shortCode) {
            errors.push({
                entry: line,
                reason: 'Short code ya short URL do',
            });
            return;
        }

        if (seenCodes.has(shortCode)) {
            errors.push({
                entry: line,
                reason: 'Duplicate short code same batch mein allowed nahi hai',
            });
            return;
        }

        seenCodes.add(shortCode);
        entries.push({
            shortCode,
            rawEntry: line,
        });
    });

    return { entries, errors };
}

function escapeCsvValue(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function sendCsvDownload(res, filename, headers, rows) {
    const csvRows = [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(','))
        .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(`\uFEFF${csvRows}`);
}

function formatDisplayDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

router.post('/bulk-shorten', auth, async (req, res) => {
    try {
        const user = await ensureBulkAccess(req, res);
        if (!user) return;

        const urlList = splitBulkLines(req.body.urls).filter((line) => /^https?:\/\//i.test(line));
        if (!urlList.length) {
            req.session.error = 'Koi valid URL nahi mili';
            return redirectToBulkTab(res);
        }

        const baseUrl = getPublicBaseUrl(req);
        const bulkResults = [];
        const errors = [];

        for (const originalUrl of urlList) {
            try {
                new URL(originalUrl);

                const already = await Url.findOne({
                    orginalUrl: originalUrl,
                    createdBy: req.user.user,
                }).select('shortCode');

                if (already) {
                    bulkResults.push({
                        original: originalUrl,
                        short: `${baseUrl}/${already.shortCode}`,
                        shortCode: already.shortCode,
                    });
                    continue;
                }

                const shortCode = await getUniqueShortCode();
                if (!shortCode) {
                    errors.push({ url: originalUrl, reason: 'Unique code generate nahi hua' });
                    continue;
                }

                const shortUrl = `${baseUrl}/${shortCode}`;
                const createdUrl = await Url.create({
                    orginalUrl: originalUrl,
                    shortUrl,
                    shortCode,
                    createdBy: req.user.user,
                    clicks: 0,
                });

                await cacheRedirectUrl(createdUrl);

                bulkResults.push({
                    original: originalUrl,
                    short: shortUrl,
                    shortCode,
                });
            } catch (urlErr) {
                errors.push({
                    url: originalUrl,
                    reason: urlErr.message || 'Invalid URL',
                });
            }
        }

        await invalidateAllUserReadCaches(req.user.user);
        await invalidateAdminDashboardCache();
        setSessionField(req.session, 'bulkResults', bulkResults);
        setSessionField(req.session, 'bulkErrors', errors);
        return redirectToBulkTab(res);
    } catch (error) {
        console.error('Bulk shorten error:', error);
        req.session.error = 'Bulk shorten complete nahi ho saka';
        return redirectToBulkTab(res);
    }
});

router.post('/bulk-update', auth, async (req, res) => {
    try {
        const user = await ensureBulkAccess(req, res);
        if (!user) return;

        const { entries, errors } = parseBulkUpdateEntries(req.body.updates);
        if (!entries.length) {
            resetBulkSessionState(req.session);
            setSessionField(req.session, 'bulkUpdateResults', []);
            setSessionField(req.session, 'bulkUpdateErrors', errors.length ? errors : [{
                entry: '',
                reason: 'Koi valid update row nahi mili',
            }]);
            return redirectToBulkTab(res);
        }

        const existingUrls = await Url.find({
            createdBy: req.user.user,
            shortCode: { $in: entries.map((entry) => entry.shortCode) },
        }).select('_id shortCode shortUrl orginalUrl createdBy adEnabled adTimer adTitle adDescription adBannerUrl adSkipable expiresAt hasPassword isActive refParam');

        const existingMap = new Map(
            existingUrls.map((urlDoc) => [String(urlDoc.shortCode).toLowerCase(), urlDoc])
        );

        const updateOperations = [];
        const targetIds = [];

        entries.forEach((entry) => {
            const matchedUrl = existingMap.get(entry.shortCode);
            if (!matchedUrl) {
                errors.push({
                    entry: entry.rawEntry,
                    reason: 'Is short code ka link nahi mila',
                });
                return;
            }

            updateOperations.push({
                updateOne: {
                    filter: { _id: matchedUrl._id },
                    update: { $set: { orginalUrl: entry.originalUrl } },
                },
            });
            targetIds.push(matchedUrl._id);
        });

        if (updateOperations.length) {
            await Url.bulkWrite(updateOperations);
        }

        const refreshedUrls = await Url.find({ _id: { $in: targetIds } }).select(
            '_id shortCode shortUrl orginalUrl createdBy adEnabled adTimer adTitle adDescription adBannerUrl adSkipable expiresAt hasPassword isActive refParam'
        ).lean();

        const refreshedMap = new Map(
            refreshedUrls.map((urlDoc) => [String(urlDoc.shortCode).toLowerCase(), urlDoc])
        );

        const results = [];
        for (const entry of entries) {
            const urlDoc = refreshedMap.get(entry.shortCode);
            if (!urlDoc) continue;

            await cacheRedirectUrl(urlDoc);
            results.push({
                shortCode: urlDoc.shortCode,
                short: urlDoc.shortUrl,
                original: urlDoc.orginalUrl,
            });
        }

        await invalidateAllUserReadCaches(req.user.user);
        await invalidateAdminDashboardCache();
        resetBulkSessionState(req.session);
        setSessionField(req.session, 'bulkUpdateResults', results);
        setSessionField(req.session, 'bulkUpdateErrors', errors);
        return redirectToBulkTab(res);
    } catch (error) {
        console.error('Bulk update error:', error);
        req.session.error = 'Bulk update complete nahi ho saka';
        return redirectToBulkTab(res);
    }
});

router.post('/bulk-delete', auth, async (req, res) => {
    try {
        const user = await ensureBulkAccess(req, res);
        if (!user) return;

        const { entries, errors } = parseBulkDeleteEntries(req.body.codes);
        if (!entries.length) {
            resetBulkSessionState(req.session);
            setSessionField(req.session, 'bulkDeleteResults', []);
            setSessionField(req.session, 'bulkDeleteErrors', errors.length ? errors : [{
                entry: '',
                reason: 'Koi valid short code nahi mila',
            }]);
            return redirectToBulkTab(res);
        }

        const existingUrls = await Url.find({
            createdBy: req.user.user,
            shortCode: { $in: entries.map((entry) => entry.shortCode) },
        }).select('_id shortCode shortUrl orginalUrl').lean();

        const existingMap = new Map(
            existingUrls.map((urlDoc) => [String(urlDoc.shortCode).toLowerCase(), urlDoc])
        );

        const deleteIds = [];
        const deletedShortCodes = [];
        const results = [];

        entries.forEach((entry) => {
            const matchedUrl = existingMap.get(entry.shortCode);
            if (!matchedUrl) {
                errors.push({
                    entry: entry.rawEntry,
                    reason: 'Is short code ka link nahi mila',
                });
                return;
            }

            deleteIds.push(matchedUrl._id);
            deletedShortCodes.push(matchedUrl.shortCode);
            results.push({
                shortCode: matchedUrl.shortCode,
                short: matchedUrl.shortUrl,
                original: matchedUrl.orginalUrl,
            });
        });

        if (deleteIds.length) {
            await Url.deleteMany({ _id: { $in: deleteIds } });
            await invalidateRedirectUrlCaches(deletedShortCodes);
        }

        await invalidateAllUserReadCaches(req.user.user);
        await invalidateAdminDashboardCache();
        resetBulkSessionState(req.session);
        setSessionField(req.session, 'bulkDeleteResults', results);
        setSessionField(req.session, 'bulkDeleteErrors', errors);
        return redirectToBulkTab(res);
    } catch (error) {
        console.error('Bulk delete error:', error);
        req.session.error = 'Bulk delete complete nahi ho saka';
        return redirectToBulkTab(res);
    }
});

router.get('/bulk-export/analytics', auth, async (req, res) => {
    try {
        const user = await ensureBulkAccess(req, res);
        if (!user) return;

        const urlDocs = await Url.find({ createdBy: req.user.user })
            .sort({ createdAt: -1 })
            .select(
                'shortCode shortUrl orginalUrl clicks createdAt lastClickedAt clickHistory.country clickHistory.city clickHistory.device clickHistory.browser clickHistory.referrer clickHistory.ip clickHistory.clickedAt'
            )
            .lean();

        const rows = urlDocs.map((urlDoc) => {
            const analytics = buildAnalyticsSummary(Array.isArray(urlDoc.clickHistory) ? urlDoc.clickHistory : []);
            return [
                urlDoc.shortCode,
                urlDoc.shortUrl,
                urlDoc.orginalUrl,
                Number(urlDoc.clicks || 0),
                analytics.uniqueVisitors,
                analytics.countries[0]?.name || '',
                analytics.devices[0]?.name || '',
                analytics.browsers[0]?.name || '',
                formatDisplayDate(urlDoc.createdAt),
                formatDisplayDate(urlDoc.lastClickedAt),
            ];
        });

        const filename = `snaplink-analytics-export-${new Date().toISOString().slice(0, 10)}.csv`;
        return sendCsvDownload(
            res,
            filename,
            [
                'Short Code',
                'Short URL',
                'Original URL',
                'Total Clicks',
                'Unique Visitors',
                'Top Country',
                'Top Device',
                'Top Browser',
                'Created At',
                'Last Clicked At',
            ],
            rows
        );
    } catch (error) {
        console.error('Bulk analytics export error:', error);
        req.session.error = 'Analytics export generate nahi ho saka';
        return redirectToBulkTab(res);
    }
});

module.exports = router;
