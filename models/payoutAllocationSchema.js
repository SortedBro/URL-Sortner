const mongoose = require('mongoose');

const payoutAllocationSchema = new mongoose.Schema(
    {
        payout: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payout',
            required: true,
            index: true,
        },
        earning: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Earning',
            required: true,
            index: true,
        },
        affiliate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        allocatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

payoutAllocationSchema.index({ payout: 1, earning: 1 }, { unique: true });
payoutAllocationSchema.index({ affiliate: 1, allocatedAt: -1 });

module.exports = mongoose.model('PayoutAllocation', payoutAllocationSchema);
