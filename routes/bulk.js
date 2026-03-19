const express = require('express');
const router  = express.Router();
const Url     = require('../models/urlSchema');   // ← apna Url model path
const User    = require('../models/userSchema');  // ← apna User model path

// ── Helper: random short code generate karo ──
// function generateCode(length = 6) {
//   const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
//   let code = '';
//   for (let i = 0; i < length; i++) {
//     code += chars[Math.floor(Math.random() * chars.length)];
//   }
//   return code;
// }

// ── Middleware: login check ──
// function isLoggedIn(req, res, next) {
//   if (req.session && req.session.userId) return next();
//   res.redirect('/login');
// }

// ── Middleware: paid plan check ──
function isPaidUser(req, res, next) {
  if (req.user && req.user.plan !== 'free') return next();
  res.status(403).json({ error: 'Bulk shortening sirf Pro/Business plan mein available hai.' });
}

// ═══════════════════════════════════════════
//  POST /bulk-shorten
//  Body: { urls: "https://...\nhttps://..." }
// ═══════════════════════════════════════════
router.post('/bulk-shorten', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    // Free plan — redirect back with error
    if (user.plan === 'free') {
      return res.redirect('/dashboard?error=Bulk+shortening+Pro+plan+mein+available+hai');
    }

    // URLs parse karo — newline se split, empty lines hata do
    const rawInput = req.body.urls || '';
    const urlList  = rawInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0 && u.startsWith('http'));

    if (urlList.length === 0) {
      return res.redirect('/dashboard?error=Koi+valid+URL+nahi+mili');
    }

    // Limit: 500 URLs per request
    const LIMIT = 500;
    const toProcess = urlList.slice(0, LIMIT);

    const bulkResults = [];
    const errors      = [];

    for (const originalUrl of toProcess) {
      try {
        // Unique short code generate karo
        let shortCode;
        let exists = true;
        let attempts = 0;

        while (exists && attempts < 10) {
          shortCode = generateCode(6);
          exists    = await Url.findOne({ shortCode });
          attempts++;
        }

        if (exists) {
          errors.push({ url: originalUrl, reason: 'Unique code generate nahi hua' });
          continue;
        }

        const baseUrl  = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const shortUrl = `${baseUrl}/${shortCode}`;

        const newUrl = await Url.create({
          orginalUrl: originalUrl,   // existing model field name match karo
          shortUrl,
          shortCode,
          userId:    req.session.userId,
          clicks:    0,
          createdAt: new Date(),
        });

        bulkResults.push({
          original: originalUrl,
          short:    shortUrl,
          shortCode,
        });

      } catch (urlErr) {
        console.error('URL error:', originalUrl, urlErr.message);
        errors.push({ url: originalUrl, reason: urlErr.message });
      }
    }

    // Dashboard pe bulkResults ke saath redirect
    // Session mein store karo taaki EJS render kar sake
    req.session.bulkResults = bulkResults;
    req.session.bulkErrors  = errors;

    res.redirect('/dashboard?tab=bulk');

  } catch (err) {
    console.error('Bulk shorten error:', err);
    res.redirect('/dashboard?error=Kuch+galat+ho+gaya');
  }
});

// ═══════════════════════════════════════════
//  GET /dashboard — bulkResults session se pass karo
//  (Agar tumhara existing dashboard route alag file
//   mein hai toh yeh wahan add karo)
// ═══════════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const urls = await Url.find({ userId: req.session.userId }).sort({ createdAt: -1 });

    // Bulk results session se nikalo aur clear karo
    const bulkResults = req.session.bulkResults || [];
    const bulkErrors  = req.session.bulkErrors  || [];
    delete req.session.bulkResults;
    delete req.session.bulkErrors;

    res.render('dashboard', {
      user,
      urls,
      bulkResults,
      bulkErrors,
      shortUrl: req.session.shortUrl || null,
      error:    req.query.error      || null,
    });

  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

module.exports = router;