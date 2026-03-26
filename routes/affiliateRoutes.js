const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { createLink, trackAndRedirect, getDashboard, getLinkAnalytics, deleteLink } = require('../controllers/affiliateControllers');

router.post('/create', auth, createLink);
router.get('/dashboard', auth, getDashboard);
router.get('/:code', trackAndRedirect);
router.get('/analytics/:code', auth, getLinkAnalytics); // ✅ naya
router.post('/delete/:code', auth, deleteLink);




module.exports = router;
// ```

// ---

// ## Test Karo

// **Step 1 — Link pe click karo:**
// ```
// GET http://localhost:3000/a/G4MjCP6
// ```

// **Step 2 — Analytics dekho:**
// ```
// GET http://localhost:3000/a/analytics/G4MjCP6