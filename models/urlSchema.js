const mongoose = require("mongoose");

// ✅ Har click ka detail
const clickSchema = new mongoose.Schema({
    clickedAt: { type: Date, default: Date.now },
    country: { type: String, default: 'Unknown' },
    city: { type: String, default: 'Unknown' },
    device: { type: String, default: 'Unknown' }, // Mobile / Desktop / Tablet
    browser: { type: String, default: 'Unknown' },
    os: { type: String, default: 'Unknown' },
    referrer: { type: String, default: 'Direct' },
    ip: { type: String, default: '' },
}, { _id: false });

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
            index:true
        },

        // Phase 1 — basic analytics
        clicks: { type: Number, default: 0 },
        lastClickedAt: { type: Date },

        // ✅ Phase 2 — detailed analytics
        clickHistory: [clickSchema],

        // Phase 3 — dashboard ke liye
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        // Phase 4 — control
        expiresAt: { type: Date },
        isActive: { type: Boolean, default: true }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Url", urlSchema);