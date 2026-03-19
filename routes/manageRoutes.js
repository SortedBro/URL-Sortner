const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/userSchema');
const Url  = require('../models/urlSchema');

function isLoggedIn(req, res, next) {
  if (req.user && req.user.user) return next();
  res.redirect('/login');
}

router.get('/settings', isLoggedIn, async (req, res) => {
  try {
    const user = { _id: req.user.user, name: req.user.name, plan: req.user.plan };
    res.render('settings', {
      user,
      success: req.query.success || null,
      error:   req.query.error   || null,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
  }
});

router.post('/settings/profile', isLoggedIn, async (req, res) => {
  try {
    const { name, email } = req.body;
    const existing = await User.findOne({ email, _id: { $ne: req.user.user } });
    if (existing) return res.redirect('/settings?error=Email+already+in+use');
    await User.findByIdAndUpdate(req.user.user, { name, email });
    res.redirect('/settings?success=Profile+updated');
  } catch (err) {
    console.error(err);
    res.redirect('/settings?error=Something+went+wrong');
  }
});

router.post('/settings/password', isLoggedIn, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword)
      return res.redirect('/settings?error=Passwords+do+not+match');
    if (newPassword.length < 6)
      return res.redirect('/settings?error=Password+must+be+at+least+6+characters');
    const user = await User.findById(req.user.user);
    if (!user) return res.redirect('/login');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.redirect('/settings?error=Current+password+is+incorrect');
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.redirect('/settings?success=Password+changed');
  } catch (err) {
    console.error(err);
    res.redirect('/settings?error=Something+went+wrong');
  }
});

router.get('/qr-codes', isLoggedIn, async (req, res) => {
  try {
    const userId = req.user.user;
    const user = { _id: userId, name: req.user.name, plan: req.user.plan };

    // FIXED: 'createdBy' field use karo — userId/user dono undefined the
    const urls = await Url.find({ createdBy: userId }).sort({ createdAt: -1 });
    console.log(`QR: ${urls.length} URLs mile user ${userId} ke liye`);

    res.render('qrcodes', { user, urls });
  } catch (err) {
    console.error('QR route error:', err);
    res.redirect('/dashboard');
  }
});

module.exports = router;