require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { createClient } = require('redis');
const { RedisStore } = require('connect-redis');

const connectDB = require('./config/db');
const { appConfig, validateCriticalConfig } = require('./config/appConfig');
const { softAuth } = require('./middleware/auth.middleware');
const { checkPlanLimit } = require('./middleware/planLimit.middleware');
const { securityHeaders } = require('./middleware/securityHeaders.middleware');
const { shortenRateLimit } = require('./middleware/rateLimit.middleware');
const { createShortUrl } = require('./controllers/urlControllers');

const urlRoutes = require('./routes/urlRoutes');
const underDevRouter = require('./routes/under-dev');
const userRouter = require('./routes/userRouters');
const pageRouter = require('./routes/pageRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const manageRoutes = require('./routes/manageRoutes');
const bulkRoutes = require('./routes/bulk');
const affiliateRoutes = require('./routes/affiliateRoutes');
const brandRoutes = require('./routes/brandRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const apiRoutes = require('./routes/apiRoutes');
const internalRoutes = require('./routes/internalRoutes');
const { clearAuthCookie } = require('./utils/authToken');
const { startClickFlushWorker, flushClickQueueNow } = require('./utils/clickQueue');

const app = express();

/**
 * Parses request body for regular routes and preserves raw webhook body for signature validation.
 */
function configureBodyParsers(expressApp) {
    expressApp.use(
        express.json({
            verify: (req, res, buf) => {
                if (req.originalUrl && req.originalUrl.startsWith('/payment/webhook')) {
                    req.rawBody = buf.toString('utf8');
                }
            },
        })
    );
    expressApp.use(express.urlencoded({ extended: false }));
}

/**
 * Initializes express-session with Redis if available, otherwise in-memory store.
 * In production we require a strong SESSION_SECRET from config validation.
 */
async function configureSession(expressApp) {
    const cookieConfig = {
        secure: appConfig.isProduction,
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 5 * 60 * 60 * 1000,
    };

    if (appConfig.redisUrl) {
        const redisClient = createClient({ url: appConfig.redisUrl });
        redisClient.on('error', (err) => console.error('Redis Session Error:', err));
        await redisClient.connect();
        console.log('Redis session store connected.');

        expressApp.use(
            session({
                store: new RedisStore({ client: redisClient }),
                secret: appConfig.sessionSecret || 'snaplink_dev_secret_2026',
                resave: false,
                saveUninitialized: false,
                cookie: cookieConfig,
            })
        );
        return;
    }

    console.log('REDIS_URL not set, using memory session store.');
    expressApp.use(
        session({
            secret: appConfig.sessionSecret || 'snaplink_dev_secret_2026',
            resave: false,
            saveUninitialized: false,
            cookie: cookieConfig,
        })
    );
}

function configureGlobalMiddleware(expressApp) {
    expressApp.disable('x-powered-by');
    expressApp.set('view engine', 'ejs');
    expressApp.set('trust proxy', 1);

    expressApp.use(express.static('public'));
    configureBodyParsers(expressApp);
    expressApp.use(cookieParser());
    expressApp.use(securityHeaders);

    // Enforce HTTPS behind proxy in production.
    expressApp.use((req, res, next) => {
        if (appConfig.isProduction && req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(`https://${req.headers.host}${req.url}`);
        }
        return next();
    });
}

function configureRouteContext(expressApp) {
    expressApp.use(softAuth);
    expressApp.use((req, res, next) => {
        res.locals.user = req.user || null;
        next();
    });
}

function registerCoreRoutes(expressApp) {
    expressApp.get('/about', (req, res) => res.render('about', { success: null, error: null }));

    expressApp.get('/logout', (req, res) => {
        clearAuthCookie(res);
        if (!req.session) return res.redirect('/');
        req.session.destroy(() => res.redirect('/'));
    });

    expressApp.get('/sitemap.xml', (req, res) => {
        const pages = [
            'https://snaplink.fun/',
            'https://snaplink.fun/features',
            'https://snaplink.fun/pricing',
            'https://snaplink.fun/about',
            'https://snaplink.fun/faq',
            'https://snaplink.fun/tools',
        ];

        const urls = pages
            .map(
                (url) => `
  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
            )
            .join('');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        res.header('Content-Type', 'application/xml');
        return res.send(xml);
    });
}

function registerApplicationRoutes(expressApp) {
    expressApp.use('/internal', internalRoutes);
    expressApp.use('/api/v1', apiRoutes);
    expressApp.use('/', paymentRoutes);
    expressApp.use('/', payoutRoutes);
    expressApp.use('/', pageRouter);
    expressApp.use('/', userRouter);
    expressApp.use('/', underDevRouter);
    expressApp.use('/', manageRoutes);
    expressApp.use('/', bulkRoutes);
    expressApp.use('/', adminRoutes);

    // Canonical + backward-compatible route mounts.
    expressApp.use('/affiliate', affiliateRoutes);
    expressApp.use('/a', affiliateRoutes);
    expressApp.use('/brand', brandRoutes);

    expressApp.post('/shorten', shortenRateLimit, checkPlanLimit, createShortUrl);

    // Keep short-code redirect catch-all at the very end.
    expressApp.use('/', urlRoutes);
}

function registerFallbackHandlers(expressApp) {
    expressApp.use((req, res) => {
        if (req.accepts('html')) return res.status(404).render('404');
        return res.status(404).json({ message: 'Not found' });
    });

    expressApp.use((error, req, res, next) => {
        console.error('Unhandled error:', error);
        if (res.headersSent) return next(error);
        if (req.accepts('html')) return res.status(500).render('404');
        return res.status(500).json({ message: 'Internal server error' });
    });
}

async function startServer() {
    validateCriticalConfig();
    await connectDB();

    configureGlobalMiddleware(app);
    await configureSession(app);
    configureRouteContext(app);
    registerCoreRoutes(app);
    registerApplicationRoutes(app);
    registerFallbackHandlers(app);
    startClickFlushWorker();

    ['SIGINT', 'SIGTERM'].forEach((signal) => {
        process.once(signal, async () => {
            try {
                await flushClickQueueNow({ maxBatches: 50 });
            } catch (error) {
                console.error('Buffered click flush during shutdown failed:', error);
            } finally {
                process.exit(0);
            }
        });
    });

    app.listen(appConfig.port, () => {
        console.log(`Server is running at ${appConfig.port}`);
        console.log(`http://localhost:${appConfig.port}/`);
    });
}

startServer().catch((error) => {
    console.error('Server bootstrap failed:', error);
    process.exit(1);
});
