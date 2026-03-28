const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true,
    },
    otp: {
        type: String,
        required: true,
    },
    // MongoDB TTL index auto-deletes OTP docs after this timestamp.
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 5 * 60 * 1000),
        expires: 0,
    },
});

module.exports = mongoose.model('Otp', otpSchema);
