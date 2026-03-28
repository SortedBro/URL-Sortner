const Earning = require('../models/earningSchema');
const Payout = require('../models/payoutSchema');
const Wallet = require('../models/walletSchema');

function toAmount(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    return Math.round(amount * 100) / 100;
}

async function ensureWallet(userId) {
    return Wallet.findOneAndUpdate(
        { user: userId },
        { $setOnInsert: { user: userId } },
        { upsert: true, new: true }
    );
}

exports.getWallet = async (req, res) => {
    try {
        const [wallet, earnings, payouts] = await Promise.all([
            ensureWallet(req.user.user),
            Earning.find({ affiliate: req.user.user })
                .populate('campaign', 'title')
                .sort({ createdAt: -1 })
                .limit(20),
            Payout.find({ affiliate: req.user.user }).sort({ createdAt: -1 }).limit(20),
        ]);

        return res.render('wallet', {
            wallet,
            earnings,
            payouts,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.requestPayout = async (req, res) => {
    try {
        const amount = toAmount(req.body.amount);
        const method = String(req.body.method || '').trim().toLowerCase();

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount daalo' });
        }

        if (amount < 100) {
            return res.status(400).json({ error: 'Minimum payout Rs.100 hai' });
        }

        if (method !== 'upi' && method !== 'bank') {
            return res.status(400).json({ error: 'Invalid payout method' });
        }

        const wallet = await ensureWallet(req.user.user);
        if (wallet.balance < amount) {
            return res.status(400).json({ error: `Insufficient balance. Tera balance: Rs.${wallet.balance.toFixed(2)}` });
        }

        const payoutPayload = {
            affiliate: req.user.user,
            amount,
            method,
            status: 'pending',
        };

        if (method === 'upi') {
            const upiId = String(req.body.upiId || '').trim().toLowerCase();
            if (!/^[a-z0-9._-]{2,}@[a-z]{2,}$/i.test(upiId)) {
                return res.status(400).json({ error: 'Valid UPI ID daalo' });
            }
            payoutPayload.upiId = upiId;
            payoutPayload.bankDetails = null;
        } else {
            const name = String(req.body.name || '').trim();
            const accountNumber = String(req.body.accountNumber || '').trim();
            const ifsc = String(req.body.ifsc || '').trim().toUpperCase();

            if (!name || !accountNumber || !ifsc) {
                return res.status(400).json({ error: 'Saari bank details daalo' });
            }
            if (!/^\d{9,18}$/.test(accountNumber)) {
                return res.status(400).json({ error: 'Account number valid nahi hai' });
            }
            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
                return res.status(400).json({ error: 'IFSC code valid nahi hai' });
            }

            payoutPayload.bankDetails = { accountNumber, ifsc, name };
            payoutPayload.upiId = null;
        }

        const updatedWallet = await Wallet.findOneAndUpdate(
            { user: req.user.user, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!updatedWallet) {
            return res.status(400).json({ error: 'Balance update fail hua, dobara try karo' });
        }

        let payout;
        try {
            payout = await Payout.create(payoutPayload);
        } catch (createError) {
            await Wallet.findOneAndUpdate({ user: req.user.user }, { $inc: { balance: amount } });
            throw createError;
        }

        return res.json({ success: true, payout, wallet: updatedWallet });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.adminGetPayouts = async (req, res) => {
    try {
        const payouts = await Payout.find()
            .populate('affiliate', 'firstName lastName email')
            .sort({ status: 1, createdAt: -1 });

        const stats = {
            pending: payouts.filter((item) => item.status === 'pending').length,
            approved: payouts.filter((item) => item.status === 'approved').length,
            paid: payouts.filter((item) => item.status === 'paid').length,
            totalPendingAmount: payouts
                .filter((item) => item.status === 'pending')
                .reduce((sum, item) => sum + Number(item.amount || 0), 0),
        };

        return res.render('admin/payouts', { payouts, stats });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.adminApprovePayout = async (req, res) => {
    try {
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ error: 'Payout nahi mila' });

        if (payout.status !== 'pending') {
            return res.status(400).json({ error: `Sirf pending payout approve ho sakta hai (current: ${payout.status})` });
        }

        payout.status = 'approved';
        payout.adminNote = String(req.body.note || '').trim();
        await payout.save();

        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.adminMarkPaid = async (req, res) => {
    try {
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ error: 'Payout nahi mila' });

        if (payout.status !== 'approved') {
            return res.status(400).json({ error: `Sirf approved payout paid mark ho sakta hai (current: ${payout.status})` });
        }

        payout.status = 'paid';
        payout.paidAt = new Date();
        payout.adminNote = String(req.body.note || payout.adminNote || '').trim();
        await payout.save();

        await Wallet.findOneAndUpdate(
            { user: payout.affiliate },
            { $inc: { totalPaid: Number(payout.amount || 0) } }
        );

        const payoutAmount = Number(payout.amount || 0);
        if (payoutAmount > 0) {
            const pendingEarnings = await Earning.find({
                affiliate: payout.affiliate,
                status: 'pending',
            }).sort({ earnedAt: 1 });

            let consumed = 0;
            for (const earning of pendingEarnings) {
                const earningAmount = Number(earning.amount || 0);
                if (!Number.isFinite(earningAmount) || earningAmount <= 0) continue;
                if (consumed + earningAmount > payoutAmount + 0.0001) break;
                earning.status = 'paid';
                consumed += earningAmount;
                await earning.save();
            }
        }

        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.adminRejectPayout = async (req, res) => {
    try {
        const payout = await Payout.findById(req.params.id);
        if (!payout) return res.status(404).json({ error: 'Payout nahi mila' });

        if (payout.status !== 'pending' && payout.status !== 'approved') {
            return res.status(400).json({ error: `Is payout ko reject nahi kar sakte (current: ${payout.status})` });
        }

        payout.status = 'rejected';
        payout.adminNote = String(req.body.note || 'Admin ne reject kiya').trim();
        await payout.save();

        await Wallet.findOneAndUpdate(
            { user: payout.affiliate },
            { $inc: { balance: Number(payout.amount || 0) } }
        );

        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};
