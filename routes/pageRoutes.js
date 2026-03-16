const express = require('express')
const router= express.Router();
const { softAuth  } = require('../middleware/auth.middleware');


router.get("/", softAuth, (req, res) => {
    const shortUrl = req.session.shortUrl || null;
    const error    = req.session.error    || null;
    req.session.shortUrl = null;
    req.session.error    = null;
    res.render('home', { shortUrl, error, user: req.user })
});

module.exports=router;