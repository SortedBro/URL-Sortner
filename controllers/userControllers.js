const User = require('../models/userSchema.js')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
require('dotenv').config()




exports.handleUserSignUP = async (req, res) => {
    const { firstName, lastName, email, password } = req.body

    //password hashed
    const hasedPassword = await bcrypt.hash(password, 10);


    // console.log("hased password" , hasedPassword)


    try {
        const validateUser =await User.findOne({ email })
        if (validateUser) {
            return res.render('signup', {

                error: 'Email allready registered , Try another email ',

                success: null,
                shortUrl: null,
            })

        } else {

            const user = await User.create({
                firstName,
                lastName,
                email,
                password: hasedPassword,
            })


            res.render('login', { shortUrl: null, error: null })

        }

    } catch (error) {
        console.log("Error:", error);


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

        //jwt token

        const accessToken = jwt.sign(

            { user: user._id },
            process.env.jwt_secret,
            { expiresIn: "10h" }
        )

        const refreshToken = jwt.sign(

            { user: user._id },
            process.env.jwt_secret,
            { expiresIn: "10h" }

        )
        // console.log("token banaya " , token);
        // console.log("jwt_secret" , process.env.jwt_secret);
        //cockie

        res.cookie("refreshToken", refreshToken.trim(), {
            httpOnly: true,
            secure: true,


        })

        res.redirect(
            '/'
        )


    } catch (error) {
        console.log("Error:", error)

    }

}