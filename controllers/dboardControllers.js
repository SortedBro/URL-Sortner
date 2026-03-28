const Url = require('../models/urlSchema');
const User = require('../models/userSchema');

exports.getDashboard = async (req, res) => {
    try {
        const userId = req.user?.user;

        const [urls, userDoc] = await Promise.all([
            Url.find({ createdBy: userId }).sort({ createdAt: -1 }),
            User.findById(userId).select('firstName lastName email plan whiteLabel'),
        ]);

        const bulkResults = req.session.bulkResults || [];
        const bulkErrors = req.session.bulkErrors || [];
        const error = req.session.error || null;
        const shortUrl = req.session.shortUrl || null;

        req.session.bulkResults = null;
        req.session.bulkErrors = null;
        req.session.error = null;
        req.session.shortUrl = null;

        const user = {
            user: userId,
            name:
                userDoc && userDoc.firstName
                    ? `${userDoc.firstName}${userDoc.lastName ? ` ${userDoc.lastName}` : ''}`.trim()
                    : (req.user?.name || 'User'),
            email: userDoc?.email || '',
            plan: userDoc?.plan || req.user?.plan || 'free',
            role: req.user?.role || 'user',
            whiteLabel: userDoc?.whiteLabel || {
                enabled: false,
                customDomain: '',
                brandName: '',
                logoUrl: '',
            },
        };

        res.render('dashboard', {
            urls,
            user,
            bulkResults,
            bulkErrors,
            error,
            shortUrl,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Server error' });
    }
};
