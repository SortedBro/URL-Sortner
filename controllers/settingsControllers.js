const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/userSchema');

function buildDisplayName(user) {
    return `${user.firstName || ''}${user.lastName ? ` ${user.lastName}` : ''}`.trim();
}

function setAuthCookie(res, user) {
    const refreshToken = jwt.sign(
        {
            user: user._id,
            name: user.firstName,
            plan: user.plan,
            role: user.role,
        },
        process.env.jwt_secret,
        { expiresIn: '10h' }
    );

    res.cookie('refreshToken', refreshToken.trim(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
}

exports.getSettings = async (req, res) => {
    try {
        const userDoc = await User.findById(req.user.user).select(
            'firstName lastName email plan role whiteLabel password'
        );

        if (!userDoc) {
            return res.redirect('/login');
        }

        const success = req.session.success || null;
        const error = req.session.error || null;
        req.session.success = null;
        req.session.error = null;

        const user = {
            user: userDoc._id,
            name: buildDisplayName(userDoc),
            email: userDoc.email,
            plan: userDoc.plan,
            role: userDoc.role,
            whiteLabel: userDoc.whiteLabel || {
                enabled: false,
                customDomain: '',
                brandName: '',
                logoUrl: '',
            },
        };

        return res.render('settings', {
            user,
            success,
            error,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const fullName = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!fullName || !email) {
            req.session.error = 'Name aur email required hai';
            return res.redirect('/settings');
        }

        const existing = await User.findOne({ email, _id: { $ne: req.user.user } });
        if (existing) {
            req.session.error = 'Ye email pehle se registered hai';
            return res.redirect('/settings');
        }

        const currentUser = await User.findById(req.user.user).select('lastName');
        const [firstName, ...rest] = fullName.split(/\s+/);
        const lastName = rest.join(' ').trim() || currentUser?.lastName || 'User';

        const user = await User.findByIdAndUpdate(
            req.user.user,
            { firstName, lastName, email },
            { new: true }
        );

        if (!user) {
            req.session.error = 'User nahi mila';
            return res.redirect('/settings');
        }

        setAuthCookie(res, user);
        req.session.success = 'Profile update ho gaya';
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        req.session.error = 'Profile update nahi ho paya';
        return res.redirect('/settings');
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');
        const confirmPassword = String(req.body.confirmPassword || '');

        if (!currentPassword || !newPassword || !confirmPassword) {
            req.session.error = 'Saare password fields required hain';
            return res.redirect('/settings');
        }

        if (newPassword.length < 6) {
            req.session.error = 'New password kam se kam 6 characters ka hona chahiye';
            return res.redirect('/settings');
        }

        if (newPassword !== confirmPassword) {
            req.session.error = 'New password aur confirm password match nahi ho rahe';
            return res.redirect('/settings');
        }

        const user = await User.findById(req.user.user);
        if (!user) {
            req.session.error = 'User nahi mila';
            return res.redirect('/settings');
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            req.session.error = 'Current password galat hai';
            return res.redirect('/settings');
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        req.session.success = 'Password update ho gaya';
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        req.session.error = 'Password update nahi ho paya';
        return res.redirect('/settings');
    }
};

exports.updateWhiteLabel = async (req, res) => {
    try {
        const user = await User.findById(req.user.user);
        if (!user) {
            req.session.error = 'User nahi mila';
            return res.redirect('/settings');
        }

        if (user.plan !== 'business') {
            req.session.error = 'White-label sirf Business plan me available hai';
            return res.redirect('/settings');
        }

        const enabled = req.body.enabled === 'on';
        const customDomain = String(req.body.customDomain || '')
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*/, '');
        const brandName = String(req.body.brandName || '').trim();
        const logoUrl = String(req.body.logoUrl || '').trim();

        if (enabled && !customDomain) {
            req.session.error = 'Enable karne ke liye custom domain required hai';
            return res.redirect('/settings');
        }

        if (customDomain && !/^(?=.{3,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(customDomain)) {
            req.session.error = 'Custom domain valid format me daalo, example: links.brand.com';
            return res.redirect('/settings');
        }

        user.whiteLabel = {
            enabled,
            customDomain,
            brandName,
            logoUrl,
        };

        await user.save();
        req.session.success = enabled
            ? 'White-label settings save ho gayi'
            : 'White-label disable ho gaya';
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        req.session.error = 'White-label settings save nahi ho payi';
        return res.redirect('/settings');
    }
};
