const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', required: true, unique: true
    },
    balance:      { type: Number, default: 0 },  // withdraw karne layak
    totalEarned:  { type: Number, default: 0 },  // lifetime total
    totalPaid:    { type: Number, default: 0 },  // ab tak mila
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);