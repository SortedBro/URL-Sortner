const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();
const path = require('path')
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { softAuth } = require('./middleware/auth.middleware');
const urlRoutes = require('./routes/urlRoutes');
const underDevRouter = require('./routes/under-dev');
const userRouter = require('./routes/userRouters')
const pageRouter = require('./routes/pageRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { checkPlanLimit } = require('./middleware/planLimit.middleware');
const { createShortUrl } = require('./controllers/urlControllers');
const { createClient } = require('redis')
const { RedisStore } = require('connect-redis')
const manageRoutes = require('./routes/manageRoutes')
const bulkroutes = require('./routes/bulk')
const affiliateRoutes = require('./routes/affiliateRoutes');
const brandRoutes = require('./routes/brandRoutes')
const payoutRoutes = require('./routes/payoutRoutes');






const port = process.env.PORT || 3000;
const app = express();

connectDB();

app.use(express.static("public"))
app.use(express.json({
    verify: (req, res, buf) => {
        if (req.originalUrl && req.originalUrl.startsWith('/payment/webhook')) {
            req.rawBody = buf.toString('utf8');
        }
    }
}))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.set('view engine', 'ejs');
app.set('trust proxy', 1)

const startServer = async () => {

    // ══════════════════════════════════════
    // ⚡ STEP 1: Sirf redirect route — kuch nahi
    // ══════════════════════════════════════
    app.use('/', urlRoutes);

    // ══════════════════════════════════════
    // ✅ STEP 2: Session setup
    // ══════════════════════════════════════
    if (process.env.REDIS_URL) {
        const sessionRedisClient = createClient({ url: process.env.REDIS_URL });
        sessionRedisClient.on('error', (err) => console.error('Redis Session Error:', err));
        await sessionRedisClient.connect();
        console.log('Redis session store connected ✅');
        app.use(session({
            store: new RedisStore({ client: sessionRedisClient }),
            secret: process.env.SESSION_SECRET || 'snaplink_secret_2026',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                httpOnly: true,
                maxAge: 5 * 60 * 60 * 1000
            }
        }));
    } else {
        console.log('Redis nahi mila — memory session use ho raha hai');
        app.use(session({
            secret: process.env.SESSION_SECRET || 'snaplink_secret_2026',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false,
                sameSite: 'lax',
                httpOnly: true,
                maxAge: 5 * 60 * 60 * 1000
            }
        }));
    }

    // ══════════════════════════════════════
    // ✅ STEP 3: Auth middleware — sirf ek baar
    // ══════════════════════════════════════
    app.use(softAuth); // ✅ session ke BAAD — sirf yahan

    app.use((req, res, next) => {
        if (process.env.NODE_ENV === 'production' &&
            req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect('https://' + req.headers.host + req.url);
        }
        next();
    });

    app.use((req, res, next) => {
        res.locals.user = req.user || null;
        next();
    });

    // ══════════════════════════════════════
    // ✅ STEP 4: Saare routes
    // ══════════════════════════════════════
    app.get('/about',   (req, res) => res.render('about', { success: null, error: null }));
    app.get('/logout', (req, res) => {
        res.clearCookie('refreshToken');
        if (!req.session) return res.redirect('/');
        req.session.destroy(() => res.redirect('/'));
    });
    app.get('/sitemap.xml', (req, res) => {
        const pages = [
            'https://snaplink.fun/',
            'https://snaplink.fun/features',
            'https://snaplink.fun/pricing',
            'https://snaplink.fun/about',
            'https://snaplink.fun/faq',
            'https://snaplink.fun/tools',
        ];
        const urls = pages.map(url => `
  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    });

    app.use('/', paymentRoutes);
    app.use('/', payoutRoutes);
    app.use('/', pageRouter);
    app.use('/', userRouter);
    app.use('/', underDevRouter);
    app.use('/', manageRoutes);     // ✅ auth ke BAAD
    app.use('/', bulkroutes);
    app.use('/', adminRoutes);      // ✅ sirf ek baar

    app.use('/a',      checkPlanLimit, affiliateRoutes);
    app.use('/brand',  brandRoutes);
    app.post('/shorten', checkPlanLimit, createShortUrl);

    app.listen(port, () => {
        console.log(`Server is running at ${port}`);
        console.log(`http://localhost:${port}/`);
    });
};

startServer();
