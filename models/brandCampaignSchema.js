const mongoose = require('mongoose');

const brandCampaignSchema = new mongoose.Schema({

    // Brand info
    brandName:   { type: String, required: true },
    brandEmail:  { type: String, required: true },
    website:     { type: String },

    // Campaign details
    title:       { type: String, required: true },
    description: { type: String, required: true },
    targetUrl:   { type: String, required: true },   // Jahan affiliate redirect hoga
    refParam:    { type: String },                   // e.g. ref=AFFCODE

    // Commission
    commissionType:   { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
    commissionValue:  { type: Number, required: true },  // e.g. 10 (percent ya rupees)
    budget:           { type: Number },                  // Total budget (optional)

    // Status
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNote: { type: String },   // Admin ka reject reason ya note

    // Owner (Brand user)
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Stats
    totalAffiliates: { type: Number, default: 0 },
    totalClicks:     { type: Number, default: 0 },

}, { timestamps: true });

brandCampaignSchema.index({ createdBy: 1, createdAt: -1 });
brandCampaignSchema.index({ status: 1, createdAt: -1 });
brandCampaignSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('BrandCampaign', brandCampaignSchema);
