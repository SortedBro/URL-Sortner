const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema({
    affiliate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', required: true
    },
    campaign: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BrandCampaign', required: true
    },
    affiliateLink: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AffiliateLink'
    },
    amount:          { type: Number, required: true }, // kitna mila
    commissionType:  { type: String, enum: ['fixed', 'percentage'] },
    settledAmount:   { type: Number, default: 0 }, // payout allocations ka running total
    status: {
        type: String,
        enum: ['pending', 'partial', 'paid'],
        default: 'pending'
    },
    earnedAt: { type: Date, default: Date.now }
}, { timestamps: true });

earningSchema.index({ affiliate: 1, status: 1, earnedAt: 1 });
earningSchema.index({ affiliate: 1, earnedAt: -1 });
earningSchema.index({ campaign: 1, earnedAt: -1 });
earningSchema.index({ affiliateLink: 1, earnedAt: -1 });

module.exports = mongoose.model('Earning', earningSchema);
