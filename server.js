const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();
const path = require('path')
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { softAuth,} = require('./middleware/auth.middleware');
const urlRoutes = require('./routes/urlRoutes');
const underDevRouter = require('./routes/under-dev');
const userRouter = require('./routes/userRouters')
const pageRouter = require('./routes/pageRoutes');
const paymentRoutes = require('./routes/paymentRoutes');






const port = process.env.PORT || 3000;

const app = express();


// database connection
connectDB();

//built in middleware 
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.set('view engine', 'ejs');

//session
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



app.get("/about", (req, res) => { res.render("about", { success: null, error: null }) });
// app.get('/404', (req, res) => { res.render("404") })

app.get('/logout', (req, res) => {
    res.clearCookie('refreshToken');
    res.redirect('/');
});

app.use('/',paymentRoutes)

//  routes

app.use('/', pageRouter)
app.use('/', userRouter)
app.use("/", underDevRouter)

// API routs 
app.use('/shorten', urlRoutes)



// redirect last may 
app.use('/', urlRoutes)


// server listing

app.listen(port, () => {
    console.log(`Server is running at ${port}`)
    console.log(`http://localhost:${port}/`)
})