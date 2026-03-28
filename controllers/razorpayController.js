const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/userSchema');
const { appConfig } = require('../config/appConfig');

const razorpay = new Razorpay({
    key_id: appConfig.razorpayKeyId,
    key_secret: appConfig.razorpayKeySecret,
});

// Plan prices in paise
const PLANS = {
    pro: {
        monthly: 9900,
        yearly: 99000,
    },
    business: {
        monthly: 299,
        yearly: 299,
    },
};

function isRazorpayConfigured() {
    return Boolean(appConfig.razorpayKeyId && appConfig.razorpayKeySecret);
}

const getSubscriptionEndDate = (billing, start = new Date()) => {
    const endDate = new Date(start);
    if (billing === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
        endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
};

exports.getUpgradePage = (req, res) => {
    const { plan } = req.query;
    if (!['pro', 'business'].includes(plan)) {
        return res.redirect('/pricing');
    }

    if (!isRazorpayConfigured()) {
        return res.status(503).render('upgrade', {
            user: req.user,
            plan,
            razorpayKeyId: '',
            error: 'Payments are temporarily unavailable. Please try later.',
        });
    }

    res.render('upgrade', {
        user: req.user,
        plan,
        razorpayKeyId: appConfig.razorpayKeyId,
    });
};

exports.createOrder = async (req, res) => {
    try {
        if (!isRazorpayConfigured()) {
            return res.status(503).json({ error: 'Payments are not configured right now' });
        }

        const { plan, billing } = req.body;

        if (!PLANS[plan] || !PLANS[plan][billing]) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        const amount = PLANS[plan][billing];
        const order = await razorpay.orders.create({
            amount,
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`,
            notes: {
                userId: String(req.user.user),
                plan,
                billing,
            },
        });

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: appConfig.razorpayKeyId,
        });
    } catch (error) {
        console.log('Create order error:', error);
        res.status(500).json({ error: 'Order create nahi hua' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        if (!isRazorpayConfigured()) {
            return res.status(503).json({ error: 'Payments are not configured right now' });
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Payment details missing' });
        }

        const signedPayload = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', appConfig.razorpayKeySecret)
            .update(signedPayload)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        // Do not trust client-provided plan/billing. Fetch from Razorpay order notes.
        const order = await razorpay.orders.fetch(razorpay_order_id);
        const plan = order?.notes?.plan;
        const billing = order?.notes?.billing;
        const orderUserId = order?.notes?.userId;

        if (!PLANS[plan] || !PLANS[plan][billing]) {
            return res.status(400).json({ error: 'Invalid order metadata' });
        }

        if (String(orderUserId) !== String(req.user.user)) {
            return res.status(403).json({ error: 'Order user mismatch' });
        }

        if (Number(order.amount) !== Number(PLANS[plan][billing])) {
            return res.status(400).json({ error: 'Amount mismatch' });
        }

        const now = new Date();
        const endDate = getSubscriptionEndDate(billing, now);

        await User.findByIdAndUpdate(req.user.user, {
            plan,
            subscription: {
                razorpayPaymentId: razorpay_payment_id,
                startDate: now,
                endDate,
                billingCycle: billing,
                status: 'active',
            },
        });

        res.json({ success: true, plan });
    } catch (error) {
        console.log('Verify payment error:', error);
        res.status(500).json({ error: 'Payment verify nahi hua' });
    }
};

exports.webhook = async (req, res) => {
    try {
        const webhookSecret = appConfig.razorpayWebhookSecret;
        if (!webhookSecret) {
            return res.status(503).json({ error: 'Webhook secret not configured' });
        }

        const signature = req.headers['x-razorpay-signature'];
        const rawBody = req.rawBody || JSON.stringify(req.body);

        const expectedSig = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        if (signature !== expectedSig) {
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }

        const event = req.body?.event;
        const payment = req.body?.payload?.payment?.entity;

        if (event === 'payment.captured') {
            const plan = payment?.notes?.plan;
            const billing = payment?.notes?.billing || 'monthly';
            const userId = payment?.notes?.userId;

            if (userId && PLANS[plan] && PLANS[plan][billing]) {
                const now = new Date();
                const endDate = getSubscriptionEndDate(billing, now);

                await User.findByIdAndUpdate(userId, {
                    plan,
                    subscription: {
                        razorpayPaymentId: payment.id,
                        startDate: now,
                        endDate,
                        billingCycle: billing,
                        status: 'active',
                    },
                });
                console.log(`Plan upgraded: ${userId} -> ${plan}`);
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.log('Webhook error:', error);
        res.status(500).json({ error: 'Webhook failed' });
    }
};
