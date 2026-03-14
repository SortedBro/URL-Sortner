const User = require('../models/userSchema.js')
const bcrypt = require('bcrypt')



exports.handleUserSignUP = async (req, res) => {
    const { firstName, lastName, email, password } = req.body

    //password hashed
    const hasedPassword = await bcrypt.hash(password, 10)


    try {
        const user = await User.create({
            firstName,
            lastName,
            email,
            password: hasedPassword,
        })

        res.render('home', { shortUrl: null, error: null })
    } catch (error) {
        console.log("Error:", error);


    }
}


exports.handleUserLogin = async (req, res) => {

    const { email, password } = req.body
    try {

        const user = await User.findOne({ email })

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


        res.redirect(
            '/'
        )


    } catch (error) {
        console.log("Error:", error)

    }

}