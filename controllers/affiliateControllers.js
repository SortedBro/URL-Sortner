const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const AffiliateLink = require('../models/affiliateLinkSchema');
const BrandCampaign = require('../models/brandCampaignSchema');
const ClickLog = require('../models/clickLogSchema');
const Earning = require('../models/earningSchema');
const Wallet = require('../models/walletSchema');
const WalletTransaction = require('../models/walletTransactionSchema');

function getBaseUrl(req) {
    const configured = process.env.APP_URL ? String(process.env.APP_URL).replace(/\/$/, '') : '';
    return configured || `${req.protocol}://${req.get('host')}`;
}

function normalizeRefParam(value) {
    if (!value) return null;
    const cleaned = String(value).trim().replace(/^\?/, '');
    return cleaned || null;
}

function appendTrackingParam(url, refParam) {
    if (!refParam) return url;
    const token = normalizeRefParam(refParam);
    if (!token) return url;

    const param = token.includes('=') ? token : `ref=${encodeURIComponent(token)}`;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${param}`;
}

function normalizeDevice(deviceType) {
    const value = String(deviceType || '').toLowerCase();
    if (value === 'mobile' || value === 'tablet') return value;
    return 'desktop';
}

function toObjectIdOrNull(value) {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
    return new mongoose.Types.ObjectId(String(value));
}

function toCountMap(rows) {
    return rows.reduce((acc, row) => {
        const key = String(row?._id || 'Unknown');
        acc[key] = Number(row?.count || 0);
        return acc;
    }, {});
}

function toIndiaDateKey(dateInput) {
    const date = new Date(dateInput);
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
}

async function createUniqueShortCode() {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = nanoid(7);
        const exists = await AffiliateLink.exists({ shortCode: code });
        if (!exists) return code;
    }
    return nanoid(9);
}

exports.createLink = async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const originalUrlInput = String(req.body.originalUrl || '').trim();
        const campaignId = String(req.body.campaignId || '').trim();

        if (!title) {
            return res.status(400).json({ error: 'Title zaroori hai' });
        }

        let campaign = null;
        if (campaignId) {
            campaign = await BrandCampaign.findOne({
                _id: campaignId,
                status: 'approved',
            }).select('title targetUrl refParam commissionType commissionValue brandName');

            if (!campaign) {
                return res.status(400).json({ error: 'Selected campaign invalid hai ya approve nahi hai' });
            }
        }

        const resolvedOriginalUrl = campaign ? String(campaign.targetUrl || '').trim() : originalUrlInput;

        if (!resolvedOriginalUrl) {
            return res.status(400).json({ error: 'Original URL zaroori hai' });
        }

        try {
            new URL(resolvedOriginalUrl);
        } catch {
            return res.status(400).json({ error: 'Valid URL daalo' });
        }

        const shortCode = await createUniqueShortCode();
        const shortUrl = `${getBaseUrl(req)}/a/${shortCode}`;

        const explicitRefParam = normalizeRefParam(req.body.refParam);
        const finalRefParam = explicitRefParam || normalizeRefParam(campaign?.refParam);

        const link = await AffiliateLink.create({
            title,
            originalUrl: resolvedOriginalUrl,
            shortCode,
            shortUrl,
            refParam: finalRefParam,
            campaign: campaign ? campaign._id : null,
            createdBy: req.user.user,
        });

        if (campaign) {
            const userHasOtherCampaignLink = await AffiliateLink.exists({
                campaign: campaign._id,
                createdBy: req.user.user,
                _id: { $ne: link._id },
            });

            if (!userHasOtherCampaignLink) {
                await BrandCampaign.findByIdAndUpdate(campaign._id, { $inc: { totalAffiliates: 1 } });
            }
        }

        return res.status(201).json({ success: true, link });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.trackAndRedirect = async (req, res) => {
    try {
        const link = await AffiliateLink.findOne({ shortCode: req.params.code }).populate(
            'campaign',
            'status commissionType commissionValue budget refParam'
        );

        if (!link || !link.isActive) {
            if (req.accepts('html')) {
                return res.status(404).render('404');
            }
            return res.status(404).json({ error: 'Link nahi mila' });
        }

        const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
        const geo = geoip.lookup(ip) || {};
        const parser = new UAParser(req.headers['user-agent'] || '');
        const ua = parser.getResult();
        const device = normalizeDevice(ua?.device?.type);

        const isUniqueIp = !(await ClickLog.exists({ link: link._id, ip }));

        await ClickLog.create({
            link: link._id,
            ip,
            country: geo.country || 'Unknown',
            city: geo.city || 'Unknown',
            device,
            browser: ua?.browser?.name || 'Unknown',
            os: ua?.os?.name || 'Unknown',
            referer: req.headers.referer || 'Direct',
        });

        const clickInc = { totalClicks: 1 };
        if (isUniqueIp) clickInc.uniqueClicks = 1;
        await AffiliateLink.findByIdAndUpdate(link._id, { $inc: clickInc });

        if (link.campaign) {
            await BrandCampaign.findByIdAndUpdate(link.campaign._id, { $inc: { totalClicks: 1 } });

            if (link.campaign.status === 'approved' && isUniqueIp) {
                const commissionAmount = Number(link.campaign.commissionValue || 0);

                if (Number.isFinite(commissionAmount) && commissionAmount > 0) {
                    let canCredit = true;
                    const budget = Number(link.campaign.budget || 0);

                    if (Number.isFinite(budget) && budget > 0) {
                        const spent = await Earning.aggregate([
                            { $match: { campaign: link.campaign._id } },
                            { $group: { _id: null, total: { $sum: '$amount' } } },
                        ]);
                        const spentAmount = Number(spent[0]?.total || 0);
                        if (spentAmount + commissionAmount > budget) {
                            canCredit = false;
                        }
                    }

                    if (canCredit) {
                        const earning = await Earning.create({
                            affiliate: link.createdBy,
                            campaign: link.campaign._id,
                            affiliateLink: link._id,
                            amount: commissionAmount,
                            commissionType: link.campaign.commissionType || 'fixed',
                            status: 'pending',
                        });

                        const wallet = await Wallet.findOneAndUpdate(
                            { user: link.createdBy },
                            {
                                $setOnInsert: { user: link.createdBy },
                                $inc: {
                                    balance: commissionAmount,
                                    totalEarned: commissionAmount,
                                },
                            },
                            { upsert: true, new: true }
                        );

                        if (wallet) {
                            await WalletTransaction.create({
                                user: link.createdBy,
                                type: 'earning_credit',
                                direction: 'credit',
                                amount: commissionAmount,
                                balanceAfter: Number(wallet.balance || 0),
                                referenceModel: 'Earning',
                                referenceId: earning._id,
                                note: `Campaign earning credit for ${link.shortCode}`,
                                metadata: {
                                    campaignId: link.campaign._id,
                                    affiliateLinkId: link._id,
                                    clickIp: ip,
                                },
                            });
                        }
                    }
                }
            }
        }

        const redirectTo = appendTrackingParam(link.originalUrl, link.refParam);
        return res.redirect(redirectTo);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const userId = String(req.user.user);
        const affiliateObjectId = toObjectIdOrNull(userId);

        const [links, campaigns, earningRows] = await Promise.all([
            AffiliateLink.find({ createdBy: req.user.user })
                .sort({ createdAt: -1 })
                .populate('campaign', 'title brandName')
                .select('title originalUrl shortCode shortUrl refParam campaign totalClicks uniqueClicks isActive createdAt')
                .lean(),
            BrandCampaign.find({ status: 'approved' })
                .select('title brandName targetUrl refParam commissionType commissionValue')
                .sort({ createdAt: -1 })
                .lean(),
            affiliateObjectId
                ? Earning.aggregate([
                    { $match: { affiliate: affiliateObjectId } },
                    {
                        $group: {
                            _id: '$status',
                            amount: { $sum: '$amount' },
                        },
                    },
                ])
                : [],
        ]);

        const totalClicks = links.reduce((sum, item) => sum + Number(item.totalClicks || 0), 0);
        const totalUniqueClicks = links.reduce((sum, item) => sum + Number(item.uniqueClicks || 0), 0);
        const activeLinks = links.filter((item) => item.isActive).length;

        let paidEarnings = 0;
        let pendingEarnings = 0;
        earningRows.forEach((row) => {
            const amount = Number(row?.amount || 0);
            if (String(row?._id) === 'paid') {
                paidEarnings += amount;
            } else {
                pendingEarnings += amount;
            }
        });
        const totalEarnings = paidEarnings + pendingEarnings;

        return res.render('affiliate-dashboard', {
            links,
            campaigns,
            stats: {
                totalLinks: links.length,
                totalClicks,
                totalUniqueClicks,
                activeLinks,
                totalEarnings,
                paidEarnings,
                pendingEarnings,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.getLinkAnalytics = async (req, res) => {
    try {
        const link = await AffiliateLink.findOne({
            shortCode: req.params.code,
            createdBy: req.user.user,
        })
            .select('title shortCode shortUrl originalUrl refParam isActive totalClicks createdAt')
            .lean();

        if (!link) {
            return res.status(404).render('404');
        }

        const linkObjectId = toObjectIdOrNull(link._id);
        if (!linkObjectId) {
            return res.status(400).json({ error: 'Invalid link identifier' });
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [dailyRows, countryRows, deviceRows, browserRows, totalLogs] = await Promise.all([
            ClickLog.aggregate([
                {
                    $match: {
                        link: linkObjectId,
                        clickedAt: { $gte: sevenDaysAgo },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$clickedAt',
                                timezone: 'Asia/Kolkata',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
            ClickLog.aggregate([
                {
                    $match: {
                        link: linkObjectId,
                        clickedAt: { $gte: sevenDaysAgo },
                    },
                },
                {
                    $group: {
                        _id: { $ifNull: ['$country', 'Unknown'] },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 20 },
            ]),
            ClickLog.aggregate([
                {
                    $match: {
                        link: linkObjectId,
                        clickedAt: { $gte: sevenDaysAgo },
                    },
                },
                {
                    $group: {
                        _id: { $ifNull: ['$device', 'desktop'] },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
            ClickLog.aggregate([
                {
                    $match: {
                        link: linkObjectId,
                        clickedAt: { $gte: sevenDaysAgo },
                    },
                },
                {
                    $group: {
                        _id: { $ifNull: ['$browser', 'Unknown'] },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 20 },
            ]),
            ClickLog.countDocuments({
                link: linkObjectId,
                clickedAt: { $gte: sevenDaysAgo },
            }),
        ]);

        const dailyClicks = {};
        for (let i = 6; i >= 0; i -= 1) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = toIndiaDateKey(date);
            dailyClicks[key] = 0;
        }
        dailyRows.forEach((row) => {
            if (dailyClicks[row._id] !== undefined) {
                dailyClicks[row._id] = Number(row.count || 0);
            }
        });

        const deviceMap = toCountMap(deviceRows);
        const topDevice = Object.entries(deviceMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

        return res.render('affiliate-analytics', {
            link,
            analytics: {
                dailyClicks,
                countries: toCountMap(countryRows),
                devices: deviceMap,
                browsers: toCountMap(browserRows),
                totalLogs,
                topDevice,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteLink = async (req, res) => {
    try {
        const deletedLink = await AffiliateLink.findOneAndDelete({
            shortCode: req.params.code,
            createdBy: req.user.user,
        });

        if (!deletedLink) {
            return res.redirect('/affiliate/dashboard');
        }

        await ClickLog.deleteMany({ link: deletedLink._id });

        if (deletedLink.campaign) {
            const affiliateUsers = await AffiliateLink.distinct('createdBy', {
                campaign: deletedLink.campaign,
            });

            await BrandCampaign.findByIdAndUpdate(deletedLink.campaign, {
                totalAffiliates: affiliateUsers.length,
            });
        }

        return res.redirect('/affiliate/dashboard');
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};
