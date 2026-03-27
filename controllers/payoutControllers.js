const Payout  = require('../models/payoutSchema');
const Wallet  = require('../models/walletSchema');
const Earning = require('../models/earningSchema');

// Affiliate — apna wallet dekhe
exports.getWallet = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ user: req.user.user });
        const earnings = await Earning.find({ affiliate: req.user.user })
                                      .populate('campaign', 'title')
                                      .sort({ createdAt: -1 })
                                      .limit(10);
        const payouts = await Payout.find({ affiliate: req.user.user })
                                    .sort({ createdAt: -1 });

        res.render('wallet', {
            wallet: wallet || { balance: 0, totalEarned: 0, totalPaid: 0 },
            earnings,
            payouts
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Affiliate — payout request karo
exports.requestPayout = async (req, res) => {
    try {
        const { amount, method, upiId, accountNumber, ifsc, name } = req.body;

        const wallet = await Wallet.findOne({ user: req.user.user });

        // Balance check karo
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({
                error: `Insufficient balance. Tera balance: ₹${wallet?.balance || 0}`
            });
        }

        // Minimum payout ₹100
        if (amount < 100) {
            return res.status(400).json({ error: 'Minimum payout ₹100 hai' });
        }

        // Payout request banao
        const payout = await Payout.create({
            affiliate: req.user.user,
            amount:    Number(amount),
            method,
            upiId:     method === 'upi' ? upiId : null,
            bankDetails: method === 'bank' ? { accountNumber, ifsc, name } : null,
            status: 'pending'
        });

        // Balance hold karo — pending mein
        wallet.balance -= Number(amount);
        await wallet.save();

        res.json({ success: true, payout });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── ADMIN SIDE ──

// Admin — saare pending payouts dekhe
exports.adminGetPayouts = async (req, res) => {
    try {
        const payouts = await Payout.find()
                                    .populate('affiliate', 'firstName lastName email')
                                    .sort({ status: 1, createdAt: -1 });

        const stats = {
            pending:  payouts.filter(p => p.status === 'pending').length,
            approved: payouts.filter(p => p.status === 'approved').length,
            paid:     payouts.filter(p => p.status === 'paid').length,
            totalPendingAmount: payouts
                .filter(p => p.status === 'pending')
                .reduce((sum, p) => sum + p.amount, 0)
        };

        res.render('admin/payouts', { payouts, stats });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin — payout approve karo
exports.adminApprovePayout = async (req, res) => {
    try {
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ error: 'Payout nahi mila' });

        payout.status    = 'approved';
        payout.adminNote = req.body.note || '';
        await payout.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin — payout paid mark karo
exports.adminMarkPaid = async (req, res) => {
    try {
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ error: 'Payout nahi mila' });

        payout.status = 'paid';
        payout.paidAt = new Date();
        await payout.save();

        // Wallet mein totalPaid update karo
        await Wallet.findOneAndUpdate(
            { user: payout.affiliate },
            { $inc: { totalPaid: payout.amount } }
        );

        // Earnings ko bhi paid mark karo
        await Earning.updateMany(
            { affiliate: payout.affiliate, status: 'pending' },
            { status: 'paid' }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin — payout reject karo
exports.adminRejectPayout = async (req, res) => {
    try {
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ error: 'Payout nahi mila' });

        // Balance wapas karo
        await Wallet.findOneAndUpdate(
            { user: payout.affiliate },
            { $inc: { balance: payout.amount } } // refund
        );

        payout.status    = 'rejected';
        payout.adminNote = req.body.note || 'Admin ne reject kiya';
        await payout.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};