const User = require('../models/userSchema');
const Url  = require('../models/urlSchema');
const os   = require('os');
const BrandCampaign = require('../models/brandCampaignSchema');


// ══════════════════════════════════
//  Admin Dashboard — Main Stats
// ══════════════════════════════════
exports.getDashboard = async (req, res) => {
    try {
        const now   = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // ── User stats ──
        const totalUsers    = await User.countDocuments();
        const newToday      = await User.countDocuments({ createdAt: { $gte: today } });
        const newThisMonth  = await User.countDocuments({ createdAt: { $gte: thisMonthStart } });
        const proUsers      = await User.countDocuments({ plan: 'pro' });
        const businessUsers = await User.countDocuments({ plan: 'business' });
        const bannedUsers   = await User.countDocuments({ isBanned: true });

        // ── URL stats ──
        const totalUrls     = await Url.countDocuments();
        const urlsToday     = await Url.countDocuments({ createdAt: { $gte: today } });
        const urlsThisMonth = await Url.countDocuments({ createdAt: { $gte: thisMonthStart } });

        // ── Total clicks ──
        const clicksAgg = await Url.aggregate([
            { $group: { _id: null, total: { $sum: '$clicks' } } }
        ]);
        const totalClicks = clicksAgg[0]?.total || 0;

        // ── Revenue estimate ──
        const proRevenue      = proUsers * 99;
        const businessRevenue = businessUsers * 299;
        const totalRevenue    = proRevenue + businessRevenue;

        // ── Recent users (last 5) ──
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('firstName lastName email plan createdAt isBanned');

        // ── Recent URLs (last 5) ──
        const recentUrls = await Url.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('createdBy', 'firstName email');

        // ── Users growth — last 7 days ──
        const userGrowth = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const end   = new Date(start); end.setDate(end.getDate() + 1);
            const count = await User.countDocuments({ createdAt: { $gte: start, $lt: end } });
            userGrowth.push({
                date:  start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                count,
            });
        }

        // ── System health ──
        const uptime      = process.uptime();
        const memUsage    = process.memoryUsage();
        const totalMem    = os.totalmem();
        const freeMem     = os.freemem();
        const memPercent  = Math.round(((totalMem - freeMem) / totalMem) * 100);
        const cpuCount    = os.cpus().length;

        res.render('admin/dashboard', {
            user: req.user,
            stats: {
                totalUsers, newToday, newThisMonth,
                proUsers, businessUsers, bannedUsers,
                totalUrls, urlsToday, urlsThisMonth,
                totalClicks, totalRevenue, proRevenue, businessRevenue,
            },
            recentUsers,
            recentUrls,
            userGrowth,
            system: {
                uptime:     Math.floor(uptime / 3600) + 'h ' + Math.floor((uptime % 3600) / 60) + 'm',
                memPercent,
                memUsed:    Math.round((totalMem - freeMem) / 1024 / 1024) + ' MB',
                memTotal:   Math.round(totalMem / 1024 / 1024) + ' MB',
                cpuCount,
                nodeVersion: process.version,
                platform:   os.platform(),
            },
        });

    } catch (error) {
        console.log('Admin dashboard error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ══════════════════════════════════
//  Users List
// ══════════════════════════════════
exports.getUsers = async (req, res) => {
    try {
        const page     = parseInt(req.query.page) || 1;
        const limit    = 20;
        const search   = req.query.search || '';
        const filter   = req.query.filter || 'all'; // all, pro, free, banned

        const query = {};
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { email:     { $regex: search, $options: 'i' } },
            ];
        }
        if (filter === 'pro')      query.plan     = 'pro';
        if (filter === 'business') query.plan     = 'business';
        if (filter === 'free')     query.plan     = 'free';
        if (filter === 'banned')   query.isBanned = true;

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('firstName lastName email plan createdAt isBanned urlsThisMonth');

        res.render('admin/users', {
            user:  req.user,
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            search,
            filter,
        });

    } catch (error) {
        console.log('Admin users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ══════════════════════════════════
//  Ban / Unban User
// ══════════════════════════════════
exports.toggleBan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User nahi mila' });

        user.isBanned = !user.isBanned;
        await user.save();

        res.json({ success: true, isBanned: user.isBanned });

    } catch (error) {
        console.log('Toggle ban error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ══════════════════════════════════
//  Delete User
// ══════════════════════════════════
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        await User.findByIdAndDelete(userId);
        await Url.deleteMany({ createdBy: userId });

        res.json({ success: true });

    } catch (error) {
        console.log('Delete user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ══════════════════════════════════
//  All URLs
// ══════════════════════════════════
exports.getUrls = async (req, res) => {
    try {
        const page   = parseInt(req.query.page) || 1;
        const limit  = 20;
        const search = req.query.search || '';

        const query = {};
        if (search) {
            query.$or = [
                { shortCode:  { $regex: search, $options: 'i' } },
                { orginalUrl: { $regex: search, $options: 'i' } },
            ];
        }

        const total = await Url.countDocuments(query);
        const urls  = await Url.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('createdBy', 'firstName email');

        res.render('admin/urls', {
            user: req.user,
            urls,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            search,
        });

    } catch (error) {
        console.log('Admin URLs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ══════════════════════════════════
//  Delete URL (admin)
// ══════════════════════════════════
exports.deleteUrl = async (req, res) => {
    try {
        await Url.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};



// ✅ Admin Panel — saare campaigns (pending pehle)
exports.getAdminPanel = async (req, res) => {
    try {
        const campaigns = await BrandCampaign.find()
                                              .populate('createdBy', 'name email')
                                              .sort({ status: 1, createdAt: -1 });
        // status: 1 → pending pehle aayega (alphabetical: a-p-r)

        const stats = {
            total:    campaigns.length,
            pending:  campaigns.filter(c => c.status === 'pending').length,
            approved: campaigns.filter(c => c.status === 'approved').length,
            rejected: campaigns.filter(c => c.status === 'rejected').length,
        };

        res.render('admin-panel', { campaigns, stats });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Campaign approve karo
exports.approveCampaign = async (req, res) => {
    try {
        const campaign = await BrandCampaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign nahi mila' });

        campaign.status = 'approved';
        campaign.adminNote = req.body.note || '';
        await campaign.save();

        res.redirect('/admin/panel');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Campaign reject karo
exports.rejectCampaign = async (req, res) => {
    try {
        const campaign = await BrandCampaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign nahi mila' });

        campaign.status = 'rejected';
        campaign.adminNote = req.body.note || 'Admin ne reject kiya';
        await campaign.save();

        res.redirect('/admin/panel');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};