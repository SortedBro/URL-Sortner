const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        name: {
            type: String,
            default: '',
            trim: true,
        },
        role: {
            type: String,
            enum: ['member', 'manager'],
            default: 'member',
        },
        status: {
            type: String,
            enum: ['invited', 'active'],
            default: 'invited',
        },
        joinedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        invitedAt: {
            type: Date,
            default: Date.now,
        },
        joinedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: false }
);

/**
 * User model.
 *
 * Notes for new developers:
 * - `plan` controls feature access and URL limits.
 * - `urlsThisMonth` + `urlsMonthYear` power free-plan monthly usage.
 * - `subscription` is updated by Razorpay verification/webhooks.
 * - `apiAccess`, `webhookSettings`, `weeklyReportSettings`, and `teamWorkspace`
 *   back premium features advertised on the pricing page.
 */
const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        plan: {
            type: String,
            enum: ['free', 'pro', 'business'],
            default: 'free',
        },
        urlsThisMonth: {
            type: Number,
            default: 0,
        },
        urlsMonthYear: {
            type: String,
            default: '',
        },
        subscription: {
            razorpaySubscriptionId: { type: String, default: null },
            razorpayPaymentId: { type: String, default: null },
            startDate: { type: Date, default: null },
            endDate: { type: Date, default: null },
            billingCycle: {
                type: String,
                enum: ['monthly', 'yearly'],
                default: 'monthly',
            },
            status: {
                type: String,
                enum: ['active', 'cancelled', 'expired'],
                default: 'active',
            },
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        isBanned: {
            type: Boolean,
            default: false,
        },
        whiteLabel: {
            enabled: { type: Boolean, default: false },
            customDomain: { type: String, default: '' },
            brandName: { type: String, default: '' },
            logoUrl: { type: String, default: '' },
        },
        apiAccess: {
            enabled: { type: Boolean, default: false },
            keyHash: { type: String, default: '' },
            keyPreview: { type: String, default: '' },
            lastRotatedAt: { type: Date, default: null },
            lastUsedAt: { type: Date, default: null },
        },
        webhookSettings: {
            enabled: { type: Boolean, default: false },
            endpointUrl: { type: String, default: '' },
            signingSecret: { type: String, default: '' },
            events: {
                type: [String],
                default: ['link.created', 'link.clicked'],
            },
            lastTriggeredAt: { type: Date, default: null },
            lastStatus: { type: String, default: 'never' },
        },
        weeklyReportSettings: {
            enabled: { type: Boolean, default: false },
            recipientEmail: { type: String, default: '' },
            weekday: {
                type: String,
                enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                default: 'monday',
            },
            lastSentAt: { type: Date, default: null },
        },
        teamWorkspace: {
            members: {
                type: [teamMemberSchema],
                default: [],
            },
        },
    },
    {
        timestamps: true,
    }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ plan: 1, createdAt: -1 });
userSchema.index({ isBanned: 1, createdAt: -1 });
userSchema.index({ 'apiAccess.keyHash': 1 }, { sparse: true });
userSchema.index({ 'whiteLabel.customDomain': 1 });
userSchema.index({
    plan: 1,
    'weeklyReportSettings.enabled': 1,
    'weeklyReportSettings.weekday': 1,
});

module.exports = mongoose.model('User', userSchema);
