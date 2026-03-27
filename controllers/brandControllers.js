const BrandCampaign = require('../models/brandCampaignSchema');

// ✅ Brand Dashboard — apne saare campaigns
exports.getBrandDashboard = async (req, res) => {
    try {
        const campaigns = await BrandCampaign.find({ createdBy: req.user.user })
                                              .sort({ createdAt: -1 });

        const stats = {
            total:    campaigns.length,
            pending:  campaigns.filter(c => c.status === 'pending').length,
            approved: campaigns.filter(c => c.status === 'approved').length,
            rejected: campaigns.filter(c => c.status === 'rejected').length,
        };

        res.render('brand-dashboard', { campaigns, stats });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Campaign submit karo (Brand)
exports.submitCampaign = async (req, res) => {
    try {
        const {
            brandName, brandEmail, website,
            title, description, targetUrl, refParam,
            commissionType, commissionValue, budget
        } = req.body;

        if (!brandName || !brandEmail || !title || !description || !targetUrl || !commissionValue) {
            return res.status(400).json({ error: 'Zaroori fields fill karo' });
        }

        const campaign = await BrandCampaign.create({
            brandName, brandEmail, website,
            title, description, targetUrl,
            refParam: refParam || null,
            commissionType: commissionType || 'fixed',
            commissionValue: Number(commissionValue),
            budget: budget ? Number(budget) : null,
            createdBy: req.user.user
        });

        res.status(201).json({ success: true, campaign });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ✅ Campaign delete (sirf pending wala)
exports.deleteCampaign = async (req, res) => {
    try {
        const campaign = await BrandCampaign.findOne({
            _id: req.params.id,
            createdBy: req.user.user
        });

        if (!campaign) return res.status(404).json({ error: 'Campaign nahi mila' });
        if (campaign.status === 'approved') {
            return res.status(403).json({ error: 'Approved campaign delete nahi hoga' });
        }

        await campaign.deleteOne();
        res.redirect('/brand/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};