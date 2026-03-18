
require('dotenv').config()
const jwt = require('jsonwebtoken')

const User = require('../models/userSchema.js')




exports.auth = async (req, res, next) => {

    const token = req.cookies?.refreshToken;
    // console.log("auth token middleware", token);

    // Token hai hi nahi
    if (!token) {
        return res.redirect('/login');
    }

    // Token hai — verify karo
    try {

        const decoded = jwt.verify(token, process.env.jwt_secret);

        // database check 
        const user = await User.findById(decoded.user);

        if(!user){
            res.clearCookie('refreshToken');
            return res.redirect('/login')
        }

        // auth.middleware.js mein
if (user.isBanned) {
    res.clearCookie('refreshToken');
    return res.redirect('/login?banned=true');
}

        // if(!user){
        //     res.clearCookie('refreshToken')
        //     req.user=null;
        //     return res.redirect('/login')
        // }

        req.user = decoded;
        next(); // ✅ valid token — aage bhejo


    } catch (error) {

        console.error("Token invalid/expired:", error.message);
        res.clearCookie("refreshToken"); // kharab token delete karo
        return res.redirect('/login'); // ✅ login pe bhejo
    }

}

exports.softAuth = (req, res, next) => {
    const token = req.cookies?.refreshToken;

    // console.log("=== softAuth chala ===")
    // console.log("req.cookies:", req.cookies)


    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.jwt_secret);
        req.user = decoded;
        next();

    } catch (error) {
        res.clearCookie("refreshToken"); // kharab token delete karo

        req.user = null;
        
        next();

    }
}

// ```

// ---

// ## Visual — Pehle vs Baad
// ```
// PEHLE:
// token aaya
//     → verify kiya
//         → error? → sirf log kiya → kuch nahi hua
//         → sahi? → next() nahi → request hang
    
// BAAD:
// token aaya
//     → verify kiya
//         → error? → cookie clear → /login redirect ✅
//         → sahi? → next() call → page load ✅