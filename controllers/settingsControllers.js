const crypto = require('crypto');
const bcrypt = require('bcrypt');

const User = require('../models/userSchema');
const { issueAuthCookie } = require('../utils/authToken');
const { generateApiKey, hashApiKey, buildApiKeyPreview } = require('../utils/apiKeys');
const { isProPlan, isBusinessPlan, getTeamSeatLimit } = require('../utils/planFeatures');
const { ALLOWED_WEBHOOK_EVENTS } = require('../utils/webhooks');
const { REPORT_WEEKDAYS, sendWeeklyReportForUser } = require('../utils/weeklyReports');
const { invalidateUserDashboardCache } = require('../utils/readCache');

function buildDisplayName(user) {
    return `${user.firstName || ''}${user.lastName ? ` ${user.lastName}` : ''}`.trim();
}

function setFlash(req, type, message) {
    if (req.session) {
        req.session[type] = message;
    }
}

function clearFlash(req) {
    const success = req.session.success || null;
    const error = req.session.error || null;
    const apiKeyPlainText = req.session.apiKeyPlainText || null;

    req.session.success = null;
    req.session.error = null;
    req.session.apiKeyPlainText = null;

    return {
        success,
        error,
        apiKeyPlainText,
    };
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());
}

function normalizeSettingsUser(userDoc) {
    const whiteLabel = userDoc.whiteLabel || {};
    const apiAccess = userDoc.apiAccess || {};
    const webhookSettings = userDoc.webhookSettings || {};
    const weeklyReportSettings = userDoc.weeklyReportSettings || {};
    const teamMembers = Array.isArray(userDoc.teamWorkspace?.members)
        ? userDoc.teamWorkspace.members.map((member) => ({
            email: member.email,
            name: member.name || '',
            role: member.role || 'member',
            status: member.status || 'invited',
            invitedAt: member.invitedAt || null,
            joinedAt: member.joinedAt || null,
        }))
        : [];

    return {
        user: userDoc._id,
        name: buildDisplayName(userDoc),
        email: userDoc.email,
        plan: userDoc.plan,
        role: userDoc.role,
        whiteLabel: {
            enabled: Boolean(whiteLabel.enabled),
            customDomain: whiteLabel.customDomain || '',
            brandName: whiteLabel.brandName || '',
            logoUrl: whiteLabel.logoUrl || '',
        },
        apiAccess: {
            enabled: Boolean(apiAccess.enabled),
            keyPreview: apiAccess.keyPreview || '',
            lastRotatedAt: apiAccess.lastRotatedAt || null,
            lastUsedAt: apiAccess.lastUsedAt || null,
        },
        webhookSettings: {
            enabled: Boolean(webhookSettings.enabled),
            endpointUrl: webhookSettings.endpointUrl || '',
            signingSecret: webhookSettings.signingSecret || '',
            events: Array.isArray(webhookSettings.events) ? webhookSettings.events : [],
            lastTriggeredAt: webhookSettings.lastTriggeredAt || null,
            lastStatus: webhookSettings.lastStatus || 'never',
        },
        weeklyReportSettings: {
            enabled: Boolean(weeklyReportSettings.enabled),
            recipientEmail: weeklyReportSettings.recipientEmail || userDoc.email || '',
            weekday: weeklyReportSettings.weekday || 'monday',
            lastSentAt: weeklyReportSettings.lastSentAt || null,
        },
        teamWorkspace: {
            members: teamMembers,
        },
        capabilities: {
            apiAccess: isProPlan(userDoc.plan),
            businessFeatures: isBusinessPlan(userDoc.plan),
            teamSeatLimit: getTeamSeatLimit(userDoc.plan),
        },
    };
}

function normalizeWeekday(value) {
    const weekday = String(value || '').trim().toLowerCase();
    return REPORT_WEEKDAYS.includes(weekday) ? weekday : 'monday';
}

exports.getSettings = async (req, res) => {
    try {
        const userDoc = await User.findById(req.user.user).select(
            'firstName lastName email plan role whiteLabel apiAccess webhookSettings weeklyReportSettings teamWorkspace'
        );

        if (!userDoc) {
            return res.redirect('/login');
        }

        const { success, error, apiKeyPlainText } = clearFlash(req);
        const user = normalizeSettingsUser(userDoc);

        return res.render('settings', {
            user,
            success,
            error,
            apiKeyPlainText,
            webhookEvents: ALLOWED_WEBHOOK_EVENTS,
            weekdayOptions: REPORT_WEEKDAYS,
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
            setFlash(req, 'error', 'Name aur email required hai');
            return res.redirect('/settings');
        }

        if (!isValidEmail(email)) {
            setFlash(req, 'error', 'Valid email address daalo');
            return res.redirect('/settings');
        }

        const existing = await User.findOne({ email, _id: { $ne: req.user.user } });
        if (existing) {
            setFlash(req, 'error', 'Ye email pehle se registered hai');
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
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        issueAuthCookie(res, user);
        await invalidateUserDashboardCache(req.user.user);
        setFlash(req, 'success', 'Profile update ho gaya');
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'Profile update nahi ho paya');
        return res.redirect('/settings');
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');
        const confirmPassword = String(req.body.confirmPassword || '');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setFlash(req, 'error', 'Saare password fields required hain');
            return res.redirect('/settings');
        }

        if (newPassword.length < 6) {
            setFlash(req, 'error', 'New password kam se kam 6 characters ka hona chahiye');
            return res.redirect('/settings');
        }

        if (newPassword !== confirmPassword) {
            setFlash(req, 'error', 'New password aur confirm password match nahi ho rahe');
            return res.redirect('/settings');
        }

        const user = await User.findById(req.user.user);
        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            setFlash(req, 'error', 'Current password galat hai');
            return res.redirect('/settings');
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        setFlash(req, 'success', 'Password update ho gaya');
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'Password update nahi ho paya');
        return res.redirect('/settings');
    }
};

exports.updateWhiteLabel = async (req, res) => {
    try {
        const user = await User.findById(req.user.user);
        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        if (!isBusinessPlan(user.plan)) {
            setFlash(req, 'error', 'White-label sirf Business plan me available hai');
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
            setFlash(req, 'error', 'Enable karne ke liye custom domain required hai');
            return res.redirect('/settings');
        }

        if (customDomain && !/^(?=.{3,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(customDomain)) {
            setFlash(req, 'error', 'Custom domain valid format me daalo, example: links.brand.com');
            return res.redirect('/settings');
        }

        user.whiteLabel = {
            enabled,
            customDomain,
            brandName,
            logoUrl,
        };

        await user.save();
        await invalidateUserDashboardCache(req.user.user);
        setFlash(req, 'success', enabled
            ? 'White-label settings save ho gayi'
            : 'White-label disable ho gaya');
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'White-label settings save nahi ho payi');
        return res.redirect('/settings');
    }
};

exports.rotateApiKey = async (req, res) => {
    try {
        const user = await User.findById(req.user.user).select('plan apiAccess');
        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        if (!isProPlan(user.plan)) {
            setFlash(req, 'error', 'API access sirf Pro aur Business plan me available hai');
            return res.redirect('/settings');
        }

        const apiKey = generateApiKey();
        user.apiAccess.enabled = true;
        user.apiAccess.keyHash = hashApiKey(apiKey);
        user.apiAccess.keyPreview = buildApiKeyPreview(apiKey);
        user.apiAccess.lastRotatedAt = new Date();
        await user.save();

        if (req.session) {
            req.session.apiKeyPlainText = apiKey;
        }

        setFlash(req, 'success', 'New API key generate ho gayi. Isse abhi copy kar lo.');
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'API key generate nahi ho payi');
        return res.redirect('/settings');
    }
};

exports.disableApiKey = async (req, res) => {
    try {
        const user = await User.findById(req.user.user).select('apiAccess');
        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        user.apiAccess.enabled = false;
        user.apiAccess.keyHash = '';
        user.apiAccess.keyPreview = '';
        user.apiAccess.lastUsedAt = null;
        await user.save();

        setFlash(req, 'success', 'API access disable ho gaya');
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'API access disable nahi ho paya');
        return res.redirect('/settings');
    }
};

exports.updateWebhookSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.user).select('plan webhookSettings');
        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        if (!isBusinessPlan(user.plan)) {
            setFlash(req, 'error', 'Webhook support sirf Business plan me available hai');
            return res.redirect('/settings');
        }

        const enabled = req.body.enabled === 'on';
        const endpointUrl = String(req.body.endpointUrl || '').trim();
        const providedSecret = String(req.body.signingSecret || '').trim();
        const rawEvents = Array.isArray(req.body.events)
            ? req.body.events
            : req.body.events
                ? [req.body.events]
                : [];
        const events = rawEvents.filter((eventName) => ALLOWED_WEBHOOK_EVENTS.includes(eventName));

        if (enabled) {
            if (!endpointUrl) {
                setFlash(req, 'error', 'Webhook endpoint URL required hai');
                return res.redirect('/settings');
            }

            try {
                const parsedUrl = new URL(endpointUrl);
                if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                    throw new Error('invalid_protocol');
                }
            } catch {
                setFlash(req, 'error', 'Webhook endpoint valid URL honi chahiye');
                return res.redirect('/settings');
            }

            if (!events.length) {
                setFlash(req, 'error', 'Kam se kam ek webhook event select karo');
                return res.redirect('/settings');
            }
        }

        user.webhookSettings.enabled = enabled;
        user.webhookSettings.endpointUrl = endpointUrl;
        user.webhookSettings.events = events;
        user.webhookSettings.signingSecret =
            providedSecret ||
            user.webhookSettings.signingSecret ||
            crypto.randomBytes(18).toString('hex');

        await user.save();

        setFlash(
            req,
            'success',
            enabled ? 'Webhook settings save ho gayi' : 'Webhook delivery pause ho gayi'
        );
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'Webhook settings save nahi ho payi');
        return res.redirect('/settings');
    }
};

exports.updateWeeklyReportSettings = async (req, res) => {
    try {
        const user = await User.findById(req.user.user).select('plan email weeklyReportSettings');
        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        if (!isBusinessPlan(user.plan)) {
            setFlash(req, 'error', 'Weekly reports sirf Business plan me available hain');
            return res.redirect('/settings');
        }

        const enabled = req.body.enabled === 'on';
        const recipientEmail = String(req.body.recipientEmail || user.email || '').trim().toLowerCase();
        const weekday = normalizeWeekday(req.body.weekday);

        if (enabled && !isValidEmail(recipientEmail)) {
            setFlash(req, 'error', 'Weekly report email valid hona chahiye');
            return res.redirect('/settings');
        }

        user.weeklyReportSettings.enabled = enabled;
        user.weeklyReportSettings.recipientEmail = recipientEmail;
        user.weeklyReportSettings.weekday = weekday;
        await user.save();

        setFlash(
            req,
            'success',
            enabled
                ? 'Weekly report schedule save ho gaya'
                : 'Weekly reports pause ho gayi'
        );
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'Weekly report settings save nahi ho payi');
        return res.redirect('/settings');
    }
};

exports.sendWeeklyReportNow = async (req, res) => {
    try {
        const user = await User.findById(req.user.user).select(
            'firstName email plan weeklyReportSettings'
        );

        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        if (!isBusinessPlan(user.plan)) {
            setFlash(req, 'error', 'Weekly reports sirf Business plan me available hain');
            return res.redirect('/settings');
        }

        const result = await sendWeeklyReportForUser(user);
        if (!result.sent) {
            setFlash(req, 'error', `Weekly report send nahi hui: ${result.reason}`);
            return res.redirect('/settings');
        }

        setFlash(req, 'success', 'Weekly report abhi send ho gayi');
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'Weekly report send nahi ho payi');
        return res.redirect('/settings');
    }
};

exports.inviteTeamMember = async (req, res) => {
    try {
        const user = await User.findById(req.user.user).select('plan teamWorkspace');
        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        if (!isBusinessPlan(user.plan)) {
            setFlash(req, 'error', 'Team workspace sirf Business plan me available hai');
            return res.redirect('/settings');
        }

        const email = String(req.body.email || '').trim().toLowerCase();
        const name = String(req.body.name || '').trim();
        const role = req.body.role === 'manager' ? 'manager' : 'member';
        const members = Array.isArray(user.teamWorkspace?.members) ? user.teamWorkspace.members : [];
        const seatLimit = getTeamSeatLimit(user.plan);

        if (!isValidEmail(email)) {
            setFlash(req, 'error', 'Team member ka valid email daalo');
            return res.redirect('/settings');
        }

        if (members.length >= seatLimit) {
            setFlash(req, 'error', `Business plan me maximum ${seatLimit} team members allowed hain`);
            return res.redirect('/settings');
        }

        if (members.some((member) => member.email === email)) {
            setFlash(req, 'error', 'Ye member already workspace me added hai');
            return res.redirect('/settings');
        }

        const joinedUser = await User.findOne({ email }).select('firstName lastName');
        members.push({
            email,
            name: name || buildDisplayName(joinedUser || { firstName: '', lastName: '' }),
            role,
            status: joinedUser ? 'active' : 'invited',
            joinedUser: joinedUser?._id || null,
            invitedAt: new Date(),
            joinedAt: joinedUser ? new Date() : null,
        });

        user.teamWorkspace.members = members;
        await user.save();

        setFlash(req, 'success', 'Team member workspace me add ho gaya');
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'Team member add nahi ho paya');
        return res.redirect('/settings');
    }
};

exports.removeTeamMember = async (req, res) => {
    try {
        const user = await User.findById(req.user.user).select('plan teamWorkspace');
        if (!user) {
            setFlash(req, 'error', 'User nahi mila');
            return res.redirect('/settings');
        }

        if (!isBusinessPlan(user.plan)) {
            setFlash(req, 'error', 'Team workspace sirf Business plan me available hai');
            return res.redirect('/settings');
        }

        const email = String(req.body.email || '').trim().toLowerCase();
        const members = Array.isArray(user.teamWorkspace?.members) ? user.teamWorkspace.members : [];
        const remainingMembers = members.filter((member) => member.email !== email);

        if (remainingMembers.length === members.length) {
            setFlash(req, 'error', 'Team member nahi mila');
            return res.redirect('/settings');
        }

        user.teamWorkspace.members = remainingMembers;
        await user.save();

        setFlash(req, 'success', 'Team member remove ho gaya');
        return res.redirect('/settings');
    } catch (error) {
        console.log(error);
        setFlash(req, 'error', 'Team member remove nahi ho paya');
        return res.redirect('/settings');
    }
};
