const Earning = require('../models/earningSchema');
const Payout = require('../models/payoutSchema');
const Wallet = require('../models/walletSchema');
const WalletTransaction = require('../models/walletTransactionSchema');
const PayoutAllocation = require('../models/payoutAllocationSchema');

function toAmount(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    return Math.round(amount * 100) / 100;
}

function signedAmount(transaction) {
    const amount = Number(transaction?.amount || 0);
    if (transaction?.direction === 'credit') return amount;
    if (transaction?.direction === 'debit') return -amount;
    return 0;
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function monthKeyFromDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthLabelFromKey(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return '';
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
    });
}

function getMonthRange(monthKeyInput) {
    const now = new Date();
    const parsed = String(monthKeyInput || '').trim();

    if (/^\d{4}-\d{2}$/.test(parsed)) {
        const [year, month] = parsed.split('-').map(Number);
        if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 1);
            return { key: parsed, start, end };
        }
    }

    const fallbackKey = monthKeyFromDate(now);
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { key: fallbackKey, start, end };
}

function buildMonthOptions(count = 12) {
    const options = [];
    const cursor = new Date();
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);

    for (let i = 0; i < count; i += 1) {
        const date = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
        const key = monthKeyFromDate(date);
        options.push({
            key,
            label: monthLabelFromKey(key),
        });
    }
    return options;
}

async function ensureWallet(userId) {
    return Wallet.findOneAndUpdate(
        { user: userId },
        { $setOnInsert: { user: userId } },
        { upsert: true, new: true }
    );
}

function mapStatementType(type) {
    switch (type) {
        case 'earning_credit':
            return 'Earning Credit';
        case 'payout_request_hold':
            return 'Payout Request';
        case 'payout_reject_release':
            return 'Payout Reversal';
        case 'payout_paid_settle':
            return 'Payout Settled';
        case 'admin_adjustment':
            return 'Admin Adjustment';
        default:
            return 'Wallet Event';
    }
}

async function createWalletTransaction({
    user,
    type,
    direction,
    amount,
    balanceAfter,
    referenceModel,
    referenceId,
    note,
    metadata,
}) {
    return WalletTransaction.create({
        user,
        type,
        direction,
        amount: Number(amount || 0),
        balanceAfter: Number(balanceAfter || 0),
        referenceModel: referenceModel || 'System',
        referenceId: referenceId || null,
        note: note || '',
        metadata: metadata || {},
    });
}

exports.getWallet = async (req, res) => {
    try {
        const userId = req.user.user;
        const selectedMonth = getMonthRange(req.query.month);
        const monthOptions = buildMonthOptions(12);

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const [wallet, earnings, payouts, statementTx, previousTx, earningAgg, payoutAgg, earningCountThisMonth, pendingPayoutCount, paidPayoutCountThisMonth] = await Promise.all([
            ensureWallet(userId),
            Earning.find({ affiliate: userId })
                .populate('campaign', 'title')
                .sort({ earnedAt: -1 })
                .limit(20)
                .lean(),
            Payout.find({ affiliate: userId }).sort({ requestedAt: -1 }).limit(20).lean(),
            WalletTransaction.find({
                user: userId,
                transactionAt: { $gte: selectedMonth.start, $lt: selectedMonth.end },
            })
                .sort({ transactionAt: -1 })
                .limit(400)
                .lean(),
            WalletTransaction.findOne({
                user: userId,
                transactionAt: { $lt: selectedMonth.start },
            })
                .sort({ transactionAt: -1 })
                .lean(),
            Earning.aggregate([
                {
                    $match: {
                        affiliate: userId,
                        earnedAt: {
                            $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$earnedAt' },
                            month: { $month: '$earnedAt' },
                        },
                        earned: { $sum: '$amount' },
                    },
                },
            ]),
            Payout.aggregate([
                {
                    $match: {
                        affiliate: userId,
                        status: 'paid',
                        paidAt: {
                            $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$paidAt' },
                            month: { $month: '$paidAt' },
                        },
                        paid: { $sum: '$amount' },
                    },
                },
            ]),
            Earning.countDocuments({
                affiliate: userId,
                earnedAt: { $gte: thisMonthStart, $lt: thisMonthEnd },
            }),
            Payout.countDocuments({
                affiliate: userId,
                status: 'pending',
            }),
            Payout.countDocuments({
                affiliate: userId,
                status: 'paid',
                paidAt: { $gte: thisMonthStart, $lt: thisMonthEnd },
            }),
        ]);

        const monthlyMap = new Map();
        for (let i = 5; i >= 0; i -= 1) {
            const date = new Date();
            date.setDate(1);
            date.setHours(0, 0, 0, 0);
            date.setMonth(date.getMonth() - i);
            const key = monthKeyFromDate(date);
            monthlyMap.set(key, {
                key,
                label: date.toLocaleDateString('en-IN', { month: 'short' }),
                earned: 0,
                paid: 0,
            });
        }

        earningAgg.forEach((row) => {
            const key = `${row._id.year}-${pad2(row._id.month)}`;
            if (monthlyMap.has(key)) {
                monthlyMap.get(key).earned = Number(row.earned || 0);
            }
        });

        payoutAgg.forEach((row) => {
            const key = `${row._id.year}-${pad2(row._id.month)}`;
            if (monthlyMap.has(key)) {
                monthlyMap.get(key).paid = Number(row.paid || 0);
            }
        });

        const monthlySeries = Array.from(monthlyMap.values());

        const statementRows = statementTx.map((item) => ({
            id: item._id,
            date: item.transactionAt,
            type: mapStatementType(item.type),
            direction: item.direction,
            amount: Number(item.amount || 0),
            balanceAfter: Number(item.balanceAfter || 0),
            note: item.note || '',
            referenceModel: item.referenceModel || '',
            referenceId: item.referenceId ? String(item.referenceId) : '',
        }));

        const currentMonthKey = monthKeyFromDate(new Date());
        let openingBalance = 0;
        let closingBalance = 0;

        if (statementTx.length > 0) {
            const oldest = statementTx[statementTx.length - 1];
            const oldestSigned = signedAmount(oldest);
            openingBalance = Number((Number(oldest.balanceAfter || 0) - oldestSigned).toFixed(2));
            closingBalance = Number(statementTx[0].balanceAfter || 0);
        } else {
            const carryForward = Number(previousTx?.balanceAfter || 0);
            openingBalance = carryForward;
            closingBalance = carryForward;
            if (selectedMonth.key === currentMonthKey && !previousTx) {
                openingBalance = Number(wallet.balance || 0);
                closingBalance = Number(wallet.balance || 0);
            }
        }

        const statementSummary = statementRows.reduce(
            (acc, row) => {
                if (row.direction === 'credit') acc.credit += row.amount;
                if (row.direction === 'debit') acc.debit += row.amount;
                return acc;
            },
            {
                opening: openingBalance,
                closing: closingBalance,
                credit: 0,
                debit: 0,
            }
        );
        statementSummary.net = Number((statementSummary.credit - statementSummary.debit).toFixed(2));

        return res.render('wallet', {
            wallet,
            earnings,
            payouts,
            monthlySeries,
            statementRows,
            statementSummary,
            statementMonth: selectedMonth.key,
            statementMonthLabel: monthLabelFromKey(selectedMonth.key),
            monthOptions,
            counters: {
                earningsThisMonth: Number(earningCountThisMonth || 0),
                pendingPayouts: Number(pendingPayoutCount || 0),
                paidThisMonth: Number(paidPayoutCountThisMonth || 0),
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.downloadWalletStatement = async (req, res) => {
    try {
        const userId = req.user.user;
        const selectedMonth = getMonthRange(req.query.month);

        const transactions = await WalletTransaction.find({
            user: userId,
            transactionAt: { $gte: selectedMonth.start, $lt: selectedMonth.end },
        })
            .sort({ transactionAt: 1 })
            .lean();

        const rows = [
            [
                'Date',
                'Type',
                'Credit',
                'Debit',
                'BalanceAfter',
                'Note',
                'ReferenceModel',
                'ReferenceId',
            ],
        ];

        transactions.forEach((item) => {
            const date = new Date(item.transactionAt).toLocaleString('en-IN');
            const credit = item.direction === 'credit' ? Number(item.amount || 0).toFixed(2) : '';
            const debit = item.direction === 'debit' ? Number(item.amount || 0).toFixed(2) : '';
            const balanceAfter = Number(item.balanceAfter || 0).toFixed(2);
            const note = String(item.note || '').replace(/\r?\n/g, ' ');
            const referenceId = item.referenceId ? String(item.referenceId) : '';

            rows.push([
                date,
                mapStatementType(item.type),
                credit,
                debit,
                balanceAfter,
                note,
                item.referenceModel || '',
                referenceId,
            ]);
        });

        const csv = rows
            .map((row) =>
                row
                    .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
                    .join(',')
            )
            .join('\n');

        const filename = `wallet-statement-${selectedMonth.key}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(`\uFEFF${csv}`);
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

        let payout = null;
        try {
            payout = await Payout.create(payoutPayload);
            await createWalletTransaction({
                user: req.user.user,
                type: 'payout_request_hold',
                direction: 'debit',
                amount,
                balanceAfter: Number(updatedWallet.balance || 0),
                referenceModel: 'Payout',
                referenceId: payout._id,
                note: 'Payout request created',
                metadata: { method },
            });
        } catch (createError) {
            if (payout?._id) {
                await Payout.findByIdAndDelete(payout._id);
            }
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
            .sort({ status: 1, createdAt: -1 })
            .lean();

        const stats = payouts.reduce(
            (acc, item) => {
                if (item.status === 'pending') {
                    acc.pending += 1;
                    acc.totalPendingAmount += Number(item.amount || 0);
                }
                if (item.status === 'approved') acc.approved += 1;
                if (item.status === 'paid') acc.paid += 1;
                return acc;
            },
            { pending: 0, approved: 0, paid: 0, totalPendingAmount: 0 }
        );

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
        let remaining = payoutAmount;
        let allocationCount = 0;

        if (payoutAmount > 0) {
            const candidateEarnings = await Earning.find({
                affiliate: payout.affiliate,
                status: { $in: ['pending', 'partial'] },
            }).sort({ earnedAt: 1 });

            for (const earning of candidateEarnings) {
                if (remaining <= 0.0001) break;

                const totalAmount = Number(earning.amount || 0);
                const settledAmount = Number(earning.settledAmount || 0);
                const available = Math.max(totalAmount - settledAmount, 0);
                if (available <= 0) continue;

                const allocated = Number(Math.min(available, remaining).toFixed(2));
                if (allocated <= 0) continue;

                await PayoutAllocation.create({
                    payout: payout._id,
                    earning: earning._id,
                    affiliate: payout.affiliate,
                    amount: allocated,
                });

                earning.settledAmount = Number((settledAmount + allocated).toFixed(2));
                if (earning.settledAmount >= totalAmount - 0.0001) {
                    earning.status = 'paid';
                } else if (earning.settledAmount > 0) {
                    earning.status = 'partial';
                }
                await earning.save();

                remaining = Number((remaining - allocated).toFixed(2));
                allocationCount += 1;
            }
        }

        const wallet = await ensureWallet(payout.affiliate);
        await createWalletTransaction({
            user: payout.affiliate,
            type: 'payout_paid_settle',
            direction: 'neutral',
            amount: payoutAmount,
            balanceAfter: Number(wallet.balance || 0),
            referenceModel: 'Payout',
            referenceId: payout._id,
            note: 'Payout settled by admin',
            metadata: {
                allocatedAmount: Number((payoutAmount - remaining).toFixed(2)),
                unmatchedAmount: Number(Math.max(remaining, 0).toFixed(2)),
                allocations: allocationCount,
            },
        });

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

        const updatedWallet = await Wallet.findOneAndUpdate(
            { user: payout.affiliate },
            { $inc: { balance: Number(payout.amount || 0) } },
            { new: true }
        );

        if (updatedWallet) {
            await createWalletTransaction({
                user: payout.affiliate,
                type: 'payout_reject_release',
                direction: 'credit',
                amount: Number(payout.amount || 0),
                balanceAfter: Number(updatedWallet.balance || 0),
                referenceModel: 'Payout',
                referenceId: payout._id,
                note: 'Payout rejected and amount refunded',
            });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
};
