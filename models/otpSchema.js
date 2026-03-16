const mongoose = require('mongoose')

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },

    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 5 * 60 * 1000), // five minites
        expires: 0, // mongoDb auto delete
    }
});


module.exports = mongoose.model("Otp", otpSchema)