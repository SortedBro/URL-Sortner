const mongoose = require('mongoose');

const clickLogSchema = new mongoose.Schema({
    link: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'AffiliateLink', 
        required: true 
    },
    ip:      { type: String },
    country: { type: String, default: 'Unknown' },
    city:    { type: String, default: 'Unknown' },
    device:  { type: String, enum: ['mobile', 'desktop', 'tablet'], default: 'desktop' },
    browser: { type: String, default: 'Unknown' },
    os:      { type: String, default: 'Unknown' },
    referer: { type: String, default: 'Direct' },
    clickedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ClickLog', clickLogSchema);