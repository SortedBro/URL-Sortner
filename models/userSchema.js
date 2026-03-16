const mongoose = require("mongoose");


const userSchema = new mongoose.Schema(
    {

        firstName: {
            type: String,
            required: true

        },
        lastName: {
            type: String,
            required: true

        },

        email: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true,
        },
        // ✅ Plan system
        plan: {
            type: String,
            enum: ['free', 'pro', 'business'],
            default: 'free',
        },
        // ✅ Monthly URL count — har mahine reset hoga
        urlsThisMonth: {
            type: Number,
            default: 0,
        },

        // ✅ Month track karo — reset ke liye
        urlsMonthYear: {
            type: String,
            default: '', // "2026-03" format
        },

        // ✅ Subscription details
        subscription: {
            razorpaySubscriptionId: { type: String, default: null },
            razorpayPaymentId: { type: String, default: null },
            startDate: { type: Date, default: null },
            endDate: { type: Date, default: null },
            billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
            status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
        },





    }, {
    timestamps: true,
}
)


module.exports = mongoose.model("User", userSchema)