const mongoose = require("mongoose");

const clickSchema = new mongoose.Schema(
    {
        clickedAt: { type: Date, default: Date.now },
        country: { type: String, default: 'Unknown' },
        city: { type: String, default: 'Unknown' },
        device: { type: String, default: 'Unknown' },
        browser: { type: String, default: 'Unknown' },
        os: { type: String, default: 'Unknown' },
        referrer: { type: String, default: 'Direct' },
        ip: { type: String, default: '' },
    },
    { _id: false }
);

const urlSchema = new mongoose.Schema(
    {
        orginalUrl: {
            type: String,
            required: true,
        },
        shortCode: {
            type: String,
            required: true,
            unique: true,
        },
        shortUrl: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        customAlias: {
            type: String,
            default: '',
        },

        adEnabled: { type: Boolean, default: false },
        adTimer: { type: Number, enum: [5, 10, 15, 30], default: 5 },
        adTitle: { type: String, default: '' },
        adDescription: { type: String, default: '' },
        adBannerUrl: { type: String, default: '' },
        adSkipable: { type: Boolean, default: true },

        clicks: { type: Number, default: 0 },
        lastClickedAt: { type: Date },
        clickHistory: [clickSchema],

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        expiresAt: { type: Date },
        hasPassword: { type: Boolean, default: false },
        accessPasswordHash: { type: String, default: '' },
        whiteLabelDomain: { type: String, default: '' },
        isActive: { type: Boolean, default: true },

        refParam: { type: String },
        clickDetails: [
            {
                ip: String,
                country: String,
                clickedAt: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Redirects use `shortCode`; dashboards and APIs list by owner/date; duplicate-check flow
// uses `(createdBy, orginalUrl)` to avoid re-creating the same basic link repeatedly.
urlSchema.index({ createdBy: 1, createdAt: -1 });
urlSchema.index({ createdBy: 1, shortCode: 1 });
urlSchema.index({ createdBy: 1, orginalUrl: 1 });
urlSchema.index({ createdAt: -1 });
urlSchema.index({ isActive: 1, expiresAt: 1 });

module.exports = mongoose.model('Url', urlSchema);
