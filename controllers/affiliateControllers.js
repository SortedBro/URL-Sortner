const { nanoid } = require('nanoid');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const AffiliateLink = require('../models/affiliateLinkSchema');
const BrandCampaign = require('../models/brandCampaignSchema');
const ClickLog = require('../models/clickLogSchema');
const Earning = require('../models/earningSchema');
const Wallet = require('../models/walletSchema');

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
                        await Earning.create({
                            affiliate: link.createdBy,
                            campaign: link.campaign._id,
                            affiliateLink: link._id,
                            amount: commissionAmount,
                            commissionType: link.campaign.commissionType || 'fixed',
                            status: 'pending',
                        });

                        await Wallet.findOneAndUpdate(
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
        const [links, campaigns, earnings] = await Promise.all([
            AffiliateLink.find({ createdBy: req.user.user })
                .sort({ createdAt: -1 })
                .populate('campaign', 'title brandName'),
            BrandCampaign.find({ status: 'approved' })
                .select('title brandName targetUrl refParam commissionType commissionValue')
                .sort({ createdAt: -1 }),
            Earning.find({ affiliate: req.user.user }).select('amount status'),
        ]);

        const totalClicks = links.reduce((sum, item) => sum + Number(item.totalClicks || 0), 0);
        const totalUniqueClicks = links.reduce((sum, item) => sum + Number(item.uniqueClicks || 0), 0);
        const activeLinks = links.filter((item) => item.isActive).length;

        const earningStats = earnings.reduce(
            (acc, item) => {
                const amount = Number(item.amount || 0);
                acc.total += amount;
                if (item.status === 'paid') acc.paid += amount;
                else acc.pending += amount;
                return acc;
            },
            { total: 0, paid: 0, pending: 0 }
        );

        return res.render('affiliate-dashboard', {
            links,
            campaigns,
            stats: {
                totalLinks: links.length,
                totalClicks,
                totalUniqueClicks,
                activeLinks,
                totalEarnings: earningStats.total,
                paidEarnings: earningStats.paid,
                pendingEarnings: earningStats.pending,
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
        });

        if (!link) {
            return res.status(404).render('404');
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const clickLogs = await ClickLog.find({
            link: link._id,
            clickedAt: { $gte: sevenDaysAgo },
        });

        const dailyClicks = {};
        for (let i = 6; i >= 0; i -= 1) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dailyClicks[date.toISOString().split('T')[0]] = 0;
        }

        clickLogs.forEach((log) => {
            const key = new Date(log.clickedAt).toISOString().split('T')[0];
            if (dailyClicks[key] !== undefined) dailyClicks[key] += 1;
        });

        const countryMap = {};
        const deviceMap = {};
        const browserMap = {};

        clickLogs.forEach((log) => {
            const country = log.country || 'Unknown';
            const device = log.device || 'desktop';
            const browser = log.browser || 'Unknown';

            countryMap[country] = (countryMap[country] || 0) + 1;
            deviceMap[device] = (deviceMap[device] || 0) + 1;
            browserMap[browser] = (browserMap[browser] || 0) + 1;
        });

        return res.render('affiliate-analytics', {
            link,
            analytics: {
                dailyClicks,
                countries: countryMap,
                devices: deviceMap,
                browsers: browserMap,
                totalLogs: clickLogs.length,
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
            return res.redirect('/a/dashboard');
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

        return res.redirect('/a/dashboard');
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};
