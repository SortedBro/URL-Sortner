const bcrypt = require('bcrypt');

const User = require('../models/userSchema');
const Otp = require('../models/otpSchema');
const { sendOtpEmail, sendWelcomeEmail } = require('../utils/sendEmail');
const { issueAuthCookie } = require('../utils/authToken');

const PENDING_SIGNUP_TTL_MS = 15 * 60 * 1000;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function renderSignupError(res, message) {
    return res.render('signup', {
        error: message,
        success: null,
    });
}

function renderLoginError(res, email, message) {
    return res.render('login', {
        error: message,
        formData: { email },
        success: null,
        shortUrl: null,
    });
}

exports.handleUserSignUP = async (req, res) => {
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    try {
        if (!firstName || !lastName || !email || !password) {
            return renderSignupError(res, 'All fields are required');
        }

        if (password.length < 6) {
            return renderSignupError(res, 'Password must be at least 6 characters');
        }

        const exists = await User.findOne({ email }).select('_id');
        if (exists) {
            return renderSignupError(res, 'Email already registered, try another email');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Signup data is kept server-side to prevent tampering from query/body edits.
        req.session.pendingSignup = {
            firstName,
            lastName,
            email,
            password: hashedPassword,
            createdAt: Date.now(),
        };

        const otp = generateOtp();
        await Otp.deleteMany({ email });
        await Otp.create({ email, otp });
        await sendOtpEmail(email, otp);

        return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.log('Signup error:', error);
        return renderSignupError(res, 'Something went wrong');
    }
};

exports.verifyOtp = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();

    try {
        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.render('verify-otp', {
                error: 'Wrong OTP or expired',
                email,
                user: null,
            });
        }

        const pending = req.session.pendingSignup;
        if (!pending?.email || !pending.createdAt) {
            return res.redirect('/signup');
        }

        if (Date.now() - Number(pending.createdAt) > PENDING_SIGNUP_TTL_MS) {
            delete req.session.pendingSignup;
            return res.render('verify-otp', {
                error: 'Signup session expired. Please signup again.',
                email,
                user: null,
            });
        }

        if (pending.email !== email) {
            return res.render('verify-otp', {
                error: 'Signup session mismatch. Please signup again.',
                email,
                user: null,
            });
        }

        await Otp.deleteOne({ email });

        const alreadyUser = await User.findOne({ email }).select('_id');
        if (alreadyUser) {
            delete req.session.pendingSignup;
            return renderSignupError(res, 'Email already registered, try another email');
        }

        const newUser = await User.create({
            firstName: pending.firstName,
            lastName: pending.lastName,
            email: pending.email,
            password: pending.password,
        });

        await sendWelcomeEmail(
            newUser.email,
            `${newUser.firstName} ${newUser.lastName || ''}`.trim()
        );
        delete req.session.pendingSignup;

        issueAuthCookie(res, newUser);
        return res.redirect('/');
    } catch (error) {
        console.log('OTP verify error:', error);
        return res.render('verify-otp', {
            error: 'Something went wrong',
            email,
            user: null,
        });
    }
};

exports.handleUserLogin = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return renderLoginError(res, email, 'Invalid email or password');
        }

        if (user.isBanned) {
            return renderLoginError(res, email, 'Account is suspended. Contact support.');
        }

        const passwordMatched = await bcrypt.compare(password, user.password);
        if (!passwordMatched) {
            return renderLoginError(res, email, 'Invalid email or password');
        }

        issueAuthCookie(res, user);
        return res.redirect('/');
    } catch (error) {
        console.log('Login error:', error);
        return renderLoginError(res, email, 'Something went wrong');
    }
};
