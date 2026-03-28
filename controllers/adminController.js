const os = require('os');

const User = require('../models/userSchema');
const Url = require('../models/urlSchema');
const BrandCampaign = require('../models/brandCampaignSchema');

const PAGE_SIZE = 20;

function parsePage(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDailyWindows(days = 7) {
    const windows = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - offset);
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        windows.push({ start, end });
    }
    return windows;
}

function toDateKey(dateInput) {
    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function withOriginalUrl(urlDoc) {
    const originalUrl = String(urlDoc?.orginalUrl || '');
    return {
        ...urlDoc,
        originalUrl,
        orginalUrl: originalUrl,
    };
}

/**
 * Admin dashboard summary.
 * Performance notes:
 * - Uses Promise.all for independent counters and recent lists.
 * - Builds 7-day growth counts in parallel instead of serial queries.
 */
exports.getDashboard = async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayWindows = buildDailyWindows(7);
        const growthWindowStart = dayWindows[0].start;

        const [
            userSummaryAgg,
            urlSummaryAgg,
            recentUsers,
            recentUrls,
            growthRows,
        ] = await Promise.all([
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        totalUsers: { $sum: 1 },
                        newToday: {
                            $sum: {
                                $cond: [{ $gte: ['$createdAt', todayStart] }, 1, 0],
                            },
                        },
                        newThisMonth: {
                            $sum: {
                                $cond: [{ $gte: ['$createdAt', monthStart] }, 1, 0],
                            },
                        },
                        proUsers: {
                            $sum: {
                                $cond: [{ $eq: ['$plan', 'pro'] }, 1, 0],
                            },
                        },
                        businessUsers: {
                            $sum: {
                                $cond: [{ $eq: ['$plan', 'business'] }, 1, 0],
                            },
                        },
                        bannedUsers: {
                            $sum: {
                                $cond: ['$isBanned', 1, 0],
                            },
                        },
                    },
                },
            ]),
            Url.aggregate([
                {
                    $group: {
                        _id: null,
                        totalUrls: { $sum: 1 },
                        urlsToday: {
                            $sum: {
                                $cond: [{ $gte: ['$createdAt', todayStart] }, 1, 0],
                            },
                        },
                        urlsThisMonth: {
                            $sum: {
                                $cond: [{ $gte: ['$createdAt', monthStart] }, 1, 0],
                            },
                        },
                        totalClicks: { $sum: '$clicks' },
                    },
                },
            ]),
            User.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select('firstName lastName email plan createdAt isBanned')
                .lean(),
            Url.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .select('shortCode shortUrl orginalUrl clicks createdAt createdBy')
                .populate('createdBy', 'firstName email')
                .lean(),
            User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: growthWindowStart },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                                timezone: 'Asia/Kolkata',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const userSummary = userSummaryAgg[0] || {};
        const urlSummary = urlSummaryAgg[0] || {};
        const sanitizedRecentUrls = recentUrls.map(withOriginalUrl);
        const growthMap = growthRows.reduce((acc, row) => {
            acc[String(row?._id || '')] = Number(row?.count || 0);
            return acc;
        }, {});

        const proUsers = Number(userSummary.proUsers || 0);
        const businessUsers = Number(userSummary.businessUsers || 0);
        const totalClicks = Number(urlSummary.totalClicks || 0);
        const proRevenue = proUsers * 99;
        const businessRevenue = businessUsers * 299;
        const totalRevenue = proRevenue + businessRevenue;

        const userGrowth = dayWindows.map((window) => ({
            date: window.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            count: Number(growthMap[toDateKey(window.start)] || 0),
        }));

        const uptimeSeconds = process.uptime();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

        return res.render('admin/dashboard', {
            user: req.user,
            stats: {
                totalUsers: Number(userSummary.totalUsers || 0),
                newToday: Number(userSummary.newToday || 0),
                newThisMonth: Number(userSummary.newThisMonth || 0),
                proUsers,
                businessUsers,
                bannedUsers: Number(userSummary.bannedUsers || 0),
                totalUrls: Number(urlSummary.totalUrls || 0),
                urlsToday: Number(urlSummary.urlsToday || 0),
                urlsThisMonth: Number(urlSummary.urlsThisMonth || 0),
                totalClicks,
                totalRevenue,
                proRevenue,
                businessRevenue,
            },
            recentUsers,
            recentUrls: sanitizedRecentUrls,
            userGrowth,
            system: {
                uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`,
                memPercent,
                memUsed: `${Math.round((totalMem - freeMem) / 1024 / 1024)} MB`,
                memTotal: `${Math.round(totalMem / 1024 / 1024)} MB`,
                cpuCount: os.cpus().length,
                nodeVersion: process.version,
                platform: os.platform(),
            },
        });
    } catch (error) {
        console.log('Admin dashboard error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const page = parsePage(req.query.page);
        const search = String(req.query.search || '').trim();
        const filter = String(req.query.filter || 'all').trim();

        const query = {};
        if (search) {
            const safeRegex = new RegExp(escapeRegex(search), 'i');
            query.$or = [{ firstName: safeRegex }, { email: safeRegex }];
        }
        if (filter === 'pro') query.plan = 'pro';
        if (filter === 'business') query.plan = 'business';
        if (filter === 'free') query.plan = 'free';
        if (filter === 'banned') query.isBanned = true;

        const [total, users] = await Promise.all([
            User.countDocuments(query),
            User.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE)
                .select('firstName lastName email plan createdAt isBanned urlsThisMonth')
                .lean(),
        ]);

        return res.render('admin/users', {
            user: req.user,
            users,
            total,
            page,
            totalPages: Math.ceil(total / PAGE_SIZE),
            search,
            filter,
        });
    } catch (error) {
        console.log('Admin users error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.toggleBan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('isBanned');
        if (!user) return res.status(404).json({ message: 'User nahi mila' });

        user.isBanned = !user.isBanned;
        await user.save();

        return res.json({ success: true, isBanned: user.isBanned });
    } catch (error) {
        console.log('Toggle ban error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        await Promise.all([
            User.findByIdAndDelete(userId),
            Url.deleteMany({ createdBy: userId }),
        ]);

        return res.json({ success: true });
    } catch (error) {
        console.log('Delete user error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.getUrls = async (req, res) => {
    try {
        const page = parsePage(req.query.page);
        const search = String(req.query.search || '').trim();

        const query = {};
        if (search) {
            const safeRegex = new RegExp(escapeRegex(search), 'i');
            query.$or = [{ shortCode: safeRegex }, { orginalUrl: safeRegex }];
        }

        const [total, rawUrls] = await Promise.all([
            Url.countDocuments(query),
            Url.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE)
                .select('shortCode shortUrl orginalUrl clicks createdAt createdBy')
                .populate('createdBy', 'firstName email')
                .lean(),
        ]);
        const urls = rawUrls.map(withOriginalUrl);

        return res.render('admin/urls', {
            user: req.user,
            urls,
            total,
            page,
            totalPages: Math.ceil(total / PAGE_SIZE),
            search,
        });
    } catch (error) {
        console.log('Admin URLs error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteUrl = async (req, res) => {
    try {
        await Url.findByIdAndDelete(req.params.id);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.getAdminPanel = async (req, res) => {
    try {
        const [rawCampaigns, campaignStatsRows] = await Promise.all([
            BrandCampaign.find()
                .select(
                    'brandName title targetUrl status adminNote totalAffiliates totalClicks createdAt createdBy'
                )
                .populate('createdBy', 'firstName lastName email')
                .sort({ status: 1, createdAt: -1 })
                .lean(),
            BrandCampaign.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const campaigns = rawCampaigns.map((campaign) => {
            if (!campaign.createdBy) return campaign;

            const name = `${campaign.createdBy.firstName || ''} ${campaign.createdBy.lastName || ''}`.trim();
            return {
                ...campaign,
                createdBy: {
                    ...campaign.createdBy,
                    name,
                },
            };
        });

        const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
        campaignStatsRows.forEach((row) => {
            const status = String(row?._id || '');
            const count = Number(row?.count || 0);
            stats.total += count;
            if (status === 'pending') stats.pending = count;
            if (status === 'approved') stats.approved = count;
            if (status === 'rejected') stats.rejected = count;
        });

        return res.render('admin-panel', { campaigns, stats });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.approveCampaign = async (req, res) => {
    try {
        const campaign = await BrandCampaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign nahi mila' });

        campaign.status = 'approved';
        campaign.adminNote = String(req.body.note || '').trim();
        await campaign.save();

        return res.redirect('/admin/campaigns');
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.rejectCampaign = async (req, res) => {
    try {
        const campaign = await BrandCampaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign nahi mila' });

        campaign.status = 'rejected';
        campaign.adminNote = String(req.body.note || 'Admin ne reject kiya').trim();
        await campaign.save();

        return res.redirect('/admin/campaigns');
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};
