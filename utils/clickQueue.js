const Url = require('../models/urlSchema');
const {
    isRedisEnabled,
    enqueueCacheListItem,
    dequeueCacheListBatch,
} = require('./redisCache');

const CLICK_QUEUE_KEY = 'queue:url-clicks:v1';
const CLICK_QUEUE_BATCH_SIZE = 250;
const CLICK_QUEUE_FLUSH_INTERVAL_MS = 5000;
const MAX_CLICK_HISTORY_ITEMS = 5000;

let workerStarted = false;
let flushPromise = null;

function normalizeClickEvent(event) {
    if (!event?.urlId || !event?.shortCode) return null;

    const clickedAt = event.clickedAt ? new Date(event.clickedAt) : new Date();
    if (Number.isNaN(clickedAt.getTime())) return null;

    return {
        urlId: String(event.urlId),
        shortCode: String(event.shortCode).trim().toLowerCase(),
        shortUrl: String(event.shortUrl || ''),
        orginalUrl: String(event.orginalUrl || ''),
        createdBy: event.createdBy ? String(event.createdBy) : null,
        clickedAt,
        country: String(event.country || 'Unknown'),
        city: String(event.city || 'Unknown'),
        device: String(event.device || 'Unknown'),
        browser: String(event.browser || 'Unknown'),
        os: String(event.os || 'Unknown'),
        referrer: String(event.referrer || 'Direct'),
        ip: String(event.ip || ''),
    };
}

async function enqueueUrlClick(event) {
    if (!isRedisEnabled()) return false;

    const normalized = normalizeClickEvent(event);
    if (!normalized) return false;

    return enqueueCacheListItem(
        CLICK_QUEUE_KEY,
        JSON.stringify({
            ...normalized,
            clickedAt: normalized.clickedAt.toISOString(),
        })
    );
}

function groupClickEvents(events) {
    const grouped = new Map();

    events.forEach((event) => {
        const normalized = normalizeClickEvent(event);
        if (!normalized) return;

        const existing = grouped.get(normalized.urlId) || {
            urlId: normalized.urlId,
            count: 0,
            lastClickedAt: normalized.clickedAt,
            clickHistory: [],
        };

        existing.count += 1;
        if (normalized.clickedAt > existing.lastClickedAt) {
            existing.lastClickedAt = normalized.clickedAt;
        }
        existing.clickHistory.push({
            clickedAt: normalized.clickedAt,
            country: normalized.country,
            city: normalized.city,
            device: normalized.device,
            browser: normalized.browser,
            os: normalized.os,
            referrer: normalized.referrer,
            ip: normalized.ip,
        });

        grouped.set(normalized.urlId, existing);
    });

    return grouped;
}

async function flushClickQueueBatch() {
    const rawBatch = await dequeueCacheListBatch(CLICK_QUEUE_KEY, CLICK_QUEUE_BATCH_SIZE);
    if (!rawBatch.length) return 0;

    const parsedEvents = rawBatch
        .map((row) => {
            try {
                return JSON.parse(row);
            } catch (error) {
                return null;
            }
        })
        .filter(Boolean);

    if (!parsedEvents.length) return rawBatch.length;

    const grouped = groupClickEvents(parsedEvents);
    const operations = [];

    grouped.forEach((group) => {
        operations.push({
            updateOne: {
                filter: { _id: group.urlId },
                update: {
                    $inc: { clicks: group.count },
                    $max: { lastClickedAt: group.lastClickedAt },
                    $push: {
                        clickHistory: {
                            $each: group.clickHistory,
                            $slice: -MAX_CLICK_HISTORY_ITEMS,
                        },
                    },
                },
            },
        });
    });

    if (!operations.length) return parsedEvents.length;

    try {
        await Url.bulkWrite(operations, { ordered: false });
        return parsedEvents.length;
    } catch (error) {
        console.error('Buffered click flush failed:', error);

        for (const item of rawBatch.reverse()) {
            await enqueueCacheListItem(CLICK_QUEUE_KEY, item);
        }

        return 0;
    }
}

async function flushClickQueueNow({ maxBatches = 10 } = {}) {
    if (!isRedisEnabled()) return 0;

    if (flushPromise) {
        return flushPromise;
    }

    flushPromise = (async () => {
        let totalFlushed = 0;

        for (let batch = 0; batch < maxBatches; batch += 1) {
            const flushed = await flushClickQueueBatch();
            totalFlushed += flushed;
            if (!flushed) break;
        }

        return totalFlushed;
    })();

    try {
        return await flushPromise;
    } finally {
        flushPromise = null;
    }
}

function startClickFlushWorker() {
    if (workerStarted || !isRedisEnabled()) return;

    workerStarted = true;
    setInterval(() => {
        flushClickQueueNow().catch((error) => {
            console.error('Buffered click worker failed:', error);
        });
    }, CLICK_QUEUE_FLUSH_INTERVAL_MS).unref();
}

module.exports = {
    enqueueUrlClick,
    flushClickQueueNow,
    startClickFlushWorker,
};
