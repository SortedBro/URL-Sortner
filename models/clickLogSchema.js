const mongoose = require('mongoose');
const clickLogSchema = new mongoose.Schema({
    link: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AffiliateLink',
        required: true
    },

    // Tracking Data

    ip: { type: String },
    country: { type: String, default: "Unknown" },
    city: { type: String, default: "Unknown" },
    device: { type: String, enum: ['mobile,desktip', 'tablet'], default: 'desktop' },
    browser: { type: String },
    referer: { type: String },

    clickedAt: { type: Date, default: Date.now }

})


module.exports = mongoose.model('ClickLog', clickLogSchema);