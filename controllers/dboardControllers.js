const Url = require('../models/urlSchema');
const User = require('../models/userSchema');

const DEFAULT_WHITE_LABEL = {
    enabled: false,
    customDomain: '',
    brandName: '',
    logoUrl: '',
};

function toDisplayName(userDoc, fallbackName = 'User') {
    const firstName = String(userDoc?.firstName || '').trim();
    const lastName = String(userDoc?.lastName || '').trim();
    const fullName = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
    return fullName || fallbackName;
}

function buildUserContext(req, userDoc) {
    return {
        user: req.user?.user || null,
        name: toDisplayName(userDoc, req.user?.name || 'User'),
        email: String(userDoc?.email || ''),
        plan: String(userDoc?.plan || req.user?.plan || 'free'),
        role: String(req.user?.role || 'user'),
        whiteLabel: userDoc?.whiteLabel || DEFAULT_WHITE_LABEL,
    };
}

function consumeSessionField(session, key, fallback) {
    const value = session?.[key];
    if (session) {
        session[key] = null;
    }
    return value ?? fallback;
}

function isSameMonth(date, referenceDate) {
    if (!date) return false;
    const target = new Date(date);
    return (
        target.getFullYear() === referenceDate.getFullYear() &&
        target.getMonth() === referenceDate.getMonth()
    );
}

function mapUrlForView(urlDoc) {
    const originalUrl = String(urlDoc?.orginalUrl || '');
    return {
        ...urlDoc,
        originalUrl,
        orginalUrl: originalUrl,
    };
}

function buildDashboardSummary(urls) {
    const now = new Date();
    const summary = {
        totalLinks: urls.length,
        totalClicks: 0,
        topLink: null,
        linksThisMonth: 0,
    };

    urls.forEach((url) => {
        const clicks = Number(url?.clicks || 0);
        summary.totalClicks += clicks;

        if (!summary.topLink || clicks > Number(summary.topLink.clicks || 0)) {
            summary.topLink = url;
        }

        if (isSameMonth(url?.createdAt, now)) {
            summary.linksThisMonth += 1;
        }
    });

    return summary;
}

exports.getDashboard = async (req, res) => {
    try {
        const userId = req.user?.user;
        if (!userId) {
            return res.redirect('/login');
        }

        const [urlDocs, userDoc] = await Promise.all([
            Url.find({ createdBy: userId })
                .sort({ createdAt: -1 })
                .select(
                    'orginalUrl shortCode shortUrl customAlias hasPassword whiteLabelDomain expiresAt adEnabled clicks createdAt'
                )
                .lean(),
            User.findById(userId)
                .select('firstName lastName email plan whiteLabel')
                .lean(),
        ]);

        const urls = urlDocs.map(mapUrlForView);
        const summary = buildDashboardSummary(urls);

        const bulkResults = consumeSessionField(req.session, 'bulkResults', []);
        const bulkErrors = consumeSessionField(req.session, 'bulkErrors', []);
        const error = consumeSessionField(req.session, 'error', null);
        const shortUrl = consumeSessionField(req.session, 'shortUrl', null);

        return res.render('dashboard', {
            urls,
            user: buildUserContext(req, userDoc),
            summary,
            bulkResults,
            bulkErrors,
            error,
            shortUrl,
        });
    } catch (renderError) {
        console.log(renderError);
        return res.status(500).json({ message: 'Server error' });
    }
};
