const BrandCampaign = require('../models/brandCampaignSchema');

const ALLOWED_COMMISSION_TYPES = new Set(['fixed', 'percentage']);

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeOptionalText(value) {
    const normalized = normalizeText(value);
    return normalized || null;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url) {
    try {
        // eslint-disable-next-line no-new
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function toPositiveNumber(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function buildCampaignStats(campaigns) {
    return campaigns.reduce(
        (acc, campaign) => {
            acc.total += 1;
            if (campaign.status === 'pending') acc.pending += 1;
            if (campaign.status === 'approved') acc.approved += 1;
            if (campaign.status === 'rejected') acc.rejected += 1;
            return acc;
        },
        { total: 0, pending: 0, approved: 0, rejected: 0 }
    );
}

exports.getBrandDashboard = async (req, res) => {
    try {
        const campaigns = await BrandCampaign.find({ createdBy: req.user.user })
            .sort({ createdAt: -1 })
            .select(
                'brandName brandEmail title description targetUrl refParam commissionType commissionValue budget status adminNote createdAt'
            )
            .lean();

        return res.render('brand-dashboard', {
            campaigns,
            stats: buildCampaignStats(campaigns),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.submitCampaign = async (req, res) => {
    try {
        const brandName = normalizeText(req.body.brandName);
        const brandEmail = normalizeText(req.body.brandEmail).toLowerCase();
        const website = normalizeOptionalText(req.body.website);
        const title = normalizeText(req.body.title);
        const description = normalizeText(req.body.description);
        const targetUrl = normalizeText(req.body.targetUrl);
        const refParam = normalizeOptionalText(req.body.refParam);
        const requestedType = normalizeText(req.body.commissionType).toLowerCase();
        const commissionType = ALLOWED_COMMISSION_TYPES.has(requestedType) ? requestedType : 'fixed';
        const commissionValue = toPositiveNumber(req.body.commissionValue);
        const budgetRaw = normalizeOptionalText(req.body.budget);
        const budget = budgetRaw ? toPositiveNumber(budgetRaw) : null;

        if (!brandName || !brandEmail || !title || !description || !targetUrl || !commissionValue) {
            return res.status(400).json({ error: 'Zaroori fields fill karo' });
        }

        if (!isValidEmail(brandEmail)) {
            return res.status(400).json({ error: 'Brand email valid format me daalo' });
        }

        if (website && !isValidUrl(website)) {
            return res.status(400).json({ error: 'Website URL valid nahi hai' });
        }

        if (!isValidUrl(targetUrl)) {
            return res.status(400).json({ error: 'Target URL valid format me daalo' });
        }

        if (budgetRaw && !budget) {
            return res.status(400).json({ error: 'Budget valid positive number hona chahiye' });
        }

        const campaign = await BrandCampaign.create({
            brandName,
            brandEmail,
            website: website || null,
            title,
            description,
            targetUrl,
            refParam,
            commissionType,
            commissionValue,
            budget,
            createdBy: req.user.user,
        });

        return res.status(201).json({ success: true, campaign });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteCampaign = async (req, res) => {
    try {
        const campaign = await BrandCampaign.findOne({
            _id: req.params.id,
            createdBy: req.user.user,
        }).select('status');

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign nahi mila' });
        }

        if (campaign.status === 'approved') {
            return res.status(403).json({ error: 'Approved campaign delete nahi hoga' });
        }

        await BrandCampaign.deleteOne({ _id: campaign._id });
        return res.redirect('/brand/campaigns');
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};
