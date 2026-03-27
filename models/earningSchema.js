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
    status: {
        type: String,
        enum: ['pending', 'paid'],
        default: 'pending'
    },
    earnedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Earning', earningSchema);