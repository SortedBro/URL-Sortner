const User = require('../models/userSchema.js')
const bcrypt = require('bcrypt')
const { name } = require('ejs')
const jwt = require('jsonwebtoken')
const Otp = require('../models/otpSchema.js')
const { sendOtpEmail } = require('../utils/sendEmail.js')
require('dotenv').config()



const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// ══════════════════════
//  SIGNUP — Step 1
//  OTP bhejo
// ══════════════════════

exports.handleUserSignUP = async (req, res) => {
    const { firstName, lastName, email, password } = req.body


    try {

        //Already refistered ? 
        const exists = await User.findOne({ email })
        if (exists) {
            return res.render('signup', {

                error: 'Email allready registered , Try another email ',
                success: null,

            })

        }
        //password hashed
        const hasedPassword = await bcrypt.hash(password, 10);

        // Temp data cookie mein rakho

        res.cookie('pendingSignup', JSON.stringify({
            firstName, lastName, email, password: hasedPassword
        },
            {
                httpOnly: true,
                maxAge: 5 * 60 * 1000 // 5minites
            }
        ))

        // Otp generate  and Sending

        const otp = generateOtp();
        await Otp.deleteMany({ email }); // delete old otp
        await Otp.create({ email, otp });
        await sendOtpEmail(email, otp)

        res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);



    } catch (error) {
        console.log("Error:", error);
        res.render('signup', { error: "Something went wrong", success: null })




    }

}

// ══════════════════════
//  SIGNUP — Step 2
//  OTP verify karo
// ══════════════════════

exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;


    try {

        const otpRecord = await Otp.findOne({ email });

        // wrong || expire

        if (!otpRecord || otpRecord.otp !== otp) {
            return res.render(
                "verify-otp",
                {
                    error: "Wrong Otp Or Expired",
                    email,
                    user: null
                });
        };

        // OTP delete - One time Use

        await Otp.deleteOne({ email });

        const pending = JSON.parse(req.cookies.pendingSignup || "{}");

        if (!pending.email) { return res.redirect('/signup') };

        // User Create 

        const newUser = await User.create({
            firstName: pending.firstName,
            lastName: pending.lastName,
            email: pending.email,
            password: pending.password,
        })

        res.clearCookie('pendingSignup');

        //jwt token

        const accessToken = jwt.sign(

            { user: User._id },
            process.env.jwt_secret,
            { expiresIn: "10h" }
        )

        const refreshToken = jwt.sign(

            {
                user: newUser._id,
                name: newUser.firstName
            },
            process.env.jwt_secret,
            { expiresIn: "10h" }

        )
        // console.log("token banaya " , token);
        // console.log("jwt_secret" , process.env.jwt_secret);
        //cockie

        res.cookie("refreshToken", refreshToken.trim(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',


        })

        res.redirect(
            '/'
        )

    } catch (error) {

        console.log(error);
        res.render('verify-otp', {
            error: "Something wernt wrong",
            email,
            user: null,
        })

    }
}


exports.handleUserLogin = async (req, res) => {

    const { email, password } = req.body
    try {

        const user = await User.findOne({ email })
        console.log("User in handle log in ", user)

        if (!user) {
            console.log('Invalid user')
            return res.render(
                "login"
                , {
                    error: 'Invalid email or password',
                    formData: { email },
                    success: null,
                    shortUrl: null,

                }
            )
        }

        // ✅ JWT token banao
        const refreshToken = jwt.sign(
            {
                user: user._id,
                name: user.firstName
            },
            process.env.jwt_secret,
            { expiresIn: "10h" }
        )

        // ✅ Cookie set karo
        res.cookie("refreshToken", refreshToken.trim(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        })

        // password decode 

        const decodePass = await bcrypt.compare(password, user.password);
        // console.log("decode pass " ,decodePass);


        if (!decodePass) {
            return res.render(
                "login"
                , {
                    error: 'Invalid email or password',
                    success: null,
                    shortUrl: null,

                }
            )
        }

        // ✅ Home pe redirect
        res.redirect('/')


    } catch (error) {
        console.log("Error:", error)

        res.render('login', {
            error: "Something went wrong",
            formData: { email },
            success: null,
            shortUrl: null,


        })

    }

}