const mongoose = require('mongoose');

/**
 * User model.
 *
 * Notes for new developers:
 * - `plan` controls feature access and URL limits.
 * - `urlsThisMonth` + `urlsMonthYear` power free-plan monthly usage.
 * - `subscription` is updated by Razorpay verification/webhooks.
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
    },
    {
        timestamps: true,
    }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ plan: 1, createdAt: -1 });
userSchema.index({ isBanned: 1 });

module.exports = mongoose.model('User', userSchema);
