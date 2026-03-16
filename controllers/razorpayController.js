const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/userSchema');

// ✅ Razorpay instance
const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Plan prices (in paise — 1 rupee = 100 paise)
const PLANS = {
    pro: {
        monthly: 9900,   // ₹99
        yearly:  99000,  // ₹990
    },
    business: {
        monthly: 29900,  // ₹299
        yearly:  299000, // ₹2990
    },
};

// ══════════════════════════════
//  Upgrade page render
// ══════════════════════════════
exports.getUpgradePage = (req, res) => {
    const { plan } = req.query;
    if (!['pro', 'business'].includes(plan)) {
        return res.redirect('/pricing');
    }
    res.render('upgrade', {
        user: req.user,
        plan,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
};

// ══════════════════════════════
//  Create Razorpay Order
// ══════════════════════════════
exports.createOrder = async (req, res) => {
    try {
        const { plan, billing } = req.body; // plan: 'pro'/'business', billing: 'monthly'/'yearly'

        if (!PLANS[plan] || !PLANS[plan][billing]) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        const amount = PLANS[plan][billing];

        const order = await razorpay.orders.create({
            amount,
            currency: 'INR',
            receipt:  `receipt_${req.user.user}_${Date.now()}`,
            notes: {
                userId:  req.user.user,
                plan,
                billing,
            },
        });

        res.json({
            orderId:  order.id,
            amount:   order.amount,
            currency: order.currency,
            keyId:    process.env.RAZORPAY_KEY_ID,
        });

    } catch (error) {
        console.log('Create order error:', error);
        res.status(500).json({ error: 'Order create nahi hua' });
    }
};

// ══════════════════════════════
//  Verify Payment + Upgrade Plan
// ══════════════════════════════
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            plan,
            billing,
        } = req.body;

        // ✅ Signature verify karo
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        // ✅ Plan end date calculate karo
        const now = new Date();
        const endDate = new Date(now);
        if (billing === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
            endDate.setMonth(endDate.getMonth() + 1);
        }

        // ✅ User ka plan upgrade karo
        await User.findByIdAndUpdate(req.user.user, {
            plan,
            subscription: {
                razorpayPaymentId: razorpay_payment_id,
                startDate:         now,
                endDate,
                billingCycle:      billing,
                status:            'active',
            },
        });

        res.json({ success: true, plan });

    } catch (error) {
        console.log('Verify payment error:', error);
        res.status(500).json({ error: 'Payment verify nahi hua' });
    }
};

// ══════════════════════════════
//  Webhook — Razorpay se auto notify
// ══════════════════════════════
exports.webhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // ✅ Webhook signature verify karo
        const signature = req.headers['x-razorpay-signature'];
        const body = JSON.stringify(req.body);
        const expectedSig = crypto
            .createHmac('sha256', webhookSecret)
            .update(body)
            .digest('hex');

        if (signature !== expectedSig) {
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        const event = req.body.event;
        const payment = req.body.payload?.payment?.entity;

        if (event === 'payment.captured') {
            const { plan, billing, userId } = payment.notes;
            if (userId && plan) {
                const now = new Date();
                const endDate = new Date(now);
                billing === 'yearly'
                    ? endDate.setFullYear(endDate.getFullYear() + 1)
                    : endDate.setMonth(endDate.getMonth() + 1);

                await User.findByIdAndUpdate(userId, {
                    plan,
                    subscription: {
                        razorpayPaymentId: payment.id,
                        startDate:         now,
                        endDate,
                        billingCycle:      billing || 'monthly',
                        status:            'active',
                    },
                });
                console.log(`✅ Plan upgraded: ${userId} → ${plan}`);
            }
        }

        res.json({ received: true });

    } catch (error) {
        console.log('Webhook error:', error);
        res.status(500).json({ error: 'Webhook failed' });
    }
};
