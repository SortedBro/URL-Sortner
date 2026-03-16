const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
require('dotenv').config();
const urlRoutes = require('./routes/urlRoutes')
const path = require('path')
const cookieParser = require('cookie-parser');
const underDevRouter = require('./routes/under-dev');
const { softAuth, auth } = require('./middleware/auth.middleware');
const { error } = require('console');
const { verifyOtp } = require('./controllers/userControllers');
const session = require('express-session');



const port = process.env.PORT || 3000;

const app = express();


// database connection
connectDB();

//built in middleware 
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.set('view engine', 'ejs');
app.use(cookieParser())

app.use(session({              // ← pehle session
    secret: process.env.SESSION_SECRET || 'snaplink_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 5 * 60 * 1000
    }
}))

app.use(softAuth)             // ← baad mein softAuth


// Sirf production mein HTTPS redirect karo
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' &&
        req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
});

// Ye middleware sab routes pe user available karega
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});
// Get Otp page

app.get('/verify-otp', (req, res) => {

    res.render('verify-otp', {
        error: null,
        email: req.query.email,
        user: null

    }
    )

})

// GET routes


// app.get("/", softAuth, (req, res) => { res.render('home', { shortUrl: null, error: null, user: req.user }) });
app.get("/", softAuth, (req, res) => {
    const shortUrl = req.session.shortUrl || null;
    const error    = req.session.error    || null;
    req.session.shortUrl = null;
    req.session.error    = null;
    res.render('home', { shortUrl, error, user: req.user })
});
app.get('/signup', (req, res) => res.render('signup', { error: null, success: null }));
app.get('/login', (req, res) => res.render('login', { error: null, success: null }));
app.get("/about", (req, res) => { res.render("about", { success: null, error: null }) });
app.get('/404', (req, res) => { res.render("404") })

app.get('/logout', (req, res) => {
    res.clearCookie('refreshToken');
    res.redirect('/');
});


// POST routes

app.use("/", underDevRouter)
app.use('/shorten', urlRoutes)
app.use('/', urlRoutes)
app.post('/verify-otp', verifyOtp)
// app.use(auth)



// server listing

app.listen(port, () => {
    console.log(`Server is running at ${port}`)
    console.log(`http://localhost:${port}/`)
})