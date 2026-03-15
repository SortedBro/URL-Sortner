
require('dotenv').config()
const jwt = require('jsonwebtoken')




exports.auth = (req, res, next) => {

    const token = req.cookies?.token;
    console.log("auth token middleware", token);

    // Token hai hi nahi
    if (!token) {
        return res.redirect('/login');
    }

    // Token hai — verify karo
    try {
        const decoded = jwt.verify(token, process.env.jwt_secret);
        req.user = decoded;
        next(); // ✅ valid token — aage bhejo
    } catch (error) {
        console.error("Token invalid/expired:", error.message);
        res.clearCookie("token"); // kharab token delete karo
        return res.redirect('/login'); // ✅ login pe bhejo
    }

}
exports.softAuth = (req, res, next) => {
    const token = req.cookies?.token;

    console.log("=== softAuth chala ===")
    console.log("req.cookies:", req.cookies)


    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.jwt_secret);
        req.user = decoded;
        next();

    } catch (error) {
        res.clearCookie("token"); // kharab token delete karo

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