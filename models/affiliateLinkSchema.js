const mongoose = require('mongoose');

const affiliateLinkSchema = new mongoose.Schema({

    // Link details
    title: { type: String, required: true },  // "Amazon Shoes Campaign"
    originalUrl: { type: String, required: true },  // merchant URL
    shortCode: { type: String, required: true, unique: true },
    shortUrl: { type: String, required: true },
    refParam: { type: String },                  // ?tag=azmat123

    // capgign track
    campaign: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BrandCampaign',
        default: null  // personal link bhi ho sakta hai
    },
    // Owner
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Stats
    totalClicks: { type: Number, default: 0 },
    uniqueClicks: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

}, { timestamps: true });

affiliateLinkSchema.index({ createdBy: 1, createdAt: -1 });
affiliateLinkSchema.index({ createdBy: 1, shortCode: 1 });
affiliateLinkSchema.index({ campaign: 1, createdBy: 1 });
affiliateLinkSchema.index({ campaign: 1, createdAt: -1 });
affiliateLinkSchema.index({ createdBy: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model('AffiliateLink', affiliateLinkSchema);
