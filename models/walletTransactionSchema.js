const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                'earning_credit',
                'payout_request_hold',
                'payout_reject_release',
                'payout_paid_settle',
                'admin_adjustment',
            ],
            required: true,
        },
        direction: {
            type: String,
            enum: ['credit', 'debit', 'neutral'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        balanceAfter: {
            type: Number,
            required: true,
        },
        referenceModel: {
            type: String,
            enum: ['Earning', 'Payout', 'BrandCampaign', 'System'],
            default: 'System',
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        note: {
            type: String,
            default: '',
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        transactionAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

walletTransactionSchema.index({ user: 1, transactionAt: -1 });
walletTransactionSchema.index({ referenceModel: 1, referenceId: 1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
