const User = require('../models/userSchema.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Otp = require('../models/otpSchema.js');
const { sendOtpEmail, sendWelcomeEmail } = require('../utils/sendEmail.js');
require('dotenv').config();

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.handleUserSignUP = async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    try {
        const exists = await User.findOne({ email });
        if (exists) {
            return res.render('signup', {
                error: 'Email allready registered , Try another email ',
                success: null,
            });
        }

        const hasedPassword = await bcrypt.hash(password, 10);

        // Store pending signup server-side to prevent client-side tampering.
        req.session.pendingSignup = {
            firstName,
            lastName,
            email,
            password: hasedPassword,
            createdAt: Date.now(),
        };

        const otp = generateOtp();
        await Otp.deleteMany({ email });
        await Otp.create({ email, otp });
        await sendOtpEmail(email, otp);

        return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.log('Error:', error);
        return res.render('signup', { error: 'Something went wrong', success: null });
    }
};

exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.render('verify-otp', {
                error: 'Wrong Otp Or Expired',
                email,
                user: null,
            });
        }

        const pending = req.session.pendingSignup;
        if (!pending?.email) {
            return res.redirect('/signup');
        }

        if (pending.email.toLowerCase() !== String(email).toLowerCase()) {
            return res.render('verify-otp', {
                error: 'Signup session mismatch. Dobara signup karo.',
                email,
                user: null,
            });
        }

        // OTP one-time use
        await Otp.deleteOne({ email });

        const alreadyUser = await User.findOne({ email: pending.email });
        if (alreadyUser) {
            delete req.session.pendingSignup;
            return res.render('signup', {
                error: 'Email allready registered , Try another email ',
                success: null,
            });
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

        const refreshToken = jwt.sign(
            {
                user: newUser._id,
                name: newUser.firstName,
                plan: newUser.plan,
                role: newUser.role,
            },
            process.env.jwt_secret,
            { expiresIn: '10h' }
        );

        res.cookie('refreshToken', refreshToken.trim(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });

        return res.redirect('/');
    } catch (error) {
        console.log(error);
        return res.render('verify-otp', {
            error: 'Something wernt wrong',
            email,
            user: null,
        });
    }
};

exports.handleUserLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('login', {
                error: 'Invalid email or password',
                formData: { email },
                success: null,
                shortUrl: null,
            });
        }

        const decodePass = await bcrypt.compare(password, user.password);
        if (!decodePass) {
            return res.render('login', {
                error: 'Invalid email or password',
                success: null,
                shortUrl: null,
            });
        }

        const refreshToken = jwt.sign(
            {
                user: user._id,
                name: user.firstName,
                plan: user.plan,
                role: user.role,
            },
            process.env.jwt_secret,
            { expiresIn: '10h' }
        );

        res.cookie('refreshToken', refreshToken.trim(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });

        return res.redirect('/');
    } catch (error) {
        console.log('Error:', error);
        return res.render('login', {
            error: 'Something went wrong',
            formData: { email },
            success: null,
            shortUrl: null,
        });
    }
};
