const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
    affiliate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', required: true
    },
    amount:    { type: Number, required: true },
    method:    { type: String, enum: ['upi', 'bank'], default: 'upi' },
    upiId:     { type: String },
    bankDetails: {
        accountNumber: String,
        ifsc:          String,
        name:          String,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'paid'],
        default: 'pending'
    },
    adminNote:   { type: String },
    requestedAt: { type: Date, default: Date.now },
    paidAt:      { type: Date },
}, { timestamps: true });

payoutSchema.index({ affiliate: 1, requestedAt: -1 });
payoutSchema.index({ affiliate: 1, status: 1, requestedAt: -1 });
payoutSchema.index({ affiliate: 1, status: 1, paidAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payout', payoutSchema);
