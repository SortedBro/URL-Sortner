// ══════════════════════════════════════════════════════
//  YT VIDEO DOWNLOADER — Backend Proxy Route
//  Cobalt.tools API use karta hai (free, open source)
//
//  SETUP:
//  1. npm install node-fetch  (agar nahi hai toh)
//  2. Yeh route apne routes/pageRoutes.js mein add karo
//  3. Ya ek alag file mein rakh ke app.js mein use karo
// ══════════════════════════════════════════════════════

// ── Option A: Apne existing routes file mein paste karo ──

router.post('/tools/yt-download', async (req, res) => {
  try {
    const {
      url,
      videoQuality  = '1080',
      downloadMode  = 'auto',   // auto | audio | mute
      audioFormat   = 'mp3',
      filenameStyle = 'basic',
    } = req.body;

    if (!url) {
      return res.status(400).json({ status: 'error', error: { code: 'no_url' } });
    }

    // Cobalt API — free & open source
    // Docs: https://github.com/imputnet/cobalt/blob/main/docs/api.md
    const cobaltRes = await fetch('https://cobalt.tools/api', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'SnapLink/1.0',
      },
      body: JSON.stringify({
        url,
        videoQuality,
        downloadMode,
        audioFormat,
        filenameStyle,
        youtubeVideoCodec: 'h264',  // h264 = best compatibility
        alwaysProxy: false,
      }),
    });

    if (!cobaltRes.ok) {
      const errText = await cobaltRes.text();
      console.error('Cobalt API error:', cobaltRes.status, errText);
      return res.status(cobaltRes.status).json({
        status: 'error',
        error: { code: 'cobalt_api_error', message: errText }
      });
    }

    const data = await cobaltRes.json();
    return res.json(data);

  } catch (err) {
    console.error('YT download proxy error:', err);
    return res.status(500).json({
      status: 'error',
      error: { code: 'server_error', message: err.message }
    });
  }
});


// ── Option B: Agar cobalt.tools ka apna instance chahiye ──
// Self-host karo: https://github.com/imputnet/cobalt
// Phir COBALT_API_URL env variable mein apna URL daalo:
//
//   COBALT_API_URL=https://api.cobalt.tools
//
// Aur upar ke route mein:
//   const COBALT = process.env.COBALT_API_URL || 'https://cobalt.tools/api';
//   const cobaltRes = await fetch(COBALT, { ... });


// ══════════════════════════════════════════════════════
//  TOOLS PAGE GET ROUTE
// ══════════════════════════════════════════════════════

router.get('/tools', (req, res) => {
  res.render('tools', {
    user:     req.user || null,
    shortUrl: null,
    error:    null,
  });
});


// ══════════════════════════════════════════════════════
//  PACKAGE CHECK
//  Node.js 18+ mein fetch built-in hai.
//  Purane Node.js (< 18) ke liye:
//
//    npm install node-fetch
//
//  Phir file ke upar add karo:
//    const fetch = require('node-fetch');
// ══════════════════════════════════════════════════════