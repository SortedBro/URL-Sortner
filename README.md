# SnapLink (Production-Oriented URL Platform)

SnapLink is a full-stack URL platform built with Node.js, Express, EJS, and MongoDB.
It supports:
- short links
- analytics
- affiliate + brand workflows
- wallet + payout system
- plan upgrades (Razorpay)
- admin moderation and operations

This repository has been hardened for production-style operation with:
- centralized config validation
- secure session/cookie defaults
- auth + anti-abuse rate limiting
- safe fallback handlers
- cleaner route architecture and backward-compatible aliases

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose
- Redis (optional, for sessions + cache)
- EJS templates
- Razorpay (plan upgrades)
- Resend (OTP and welcome emails)

## Quick Start
1. Install dependencies:
```bash
npm install
```
2. Configure `.env` values (see Required Environment Variables below).
3. Run in development:
```bash
npm run dev
```
4. Run in production mode:
```bash
npm start
```

## Required Environment Variables
- `MONGODB_URI`
- `jwt_secret`
- `SESSION_SECRET` (required in production, minimum 32 chars)

## Optional Environment Variables
- `PORT` (default: `3000`)
- `NODE_ENV` (`development` or `production`)
- `APP_URL` (used for absolute short URL generation)
- `REDIS_URL` (optional session + redirect cache acceleration)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RESEND_API_KEY`

## Core Architecture (Backend)
- [`server.js`](./server.js)
  - App bootstrapping, middleware registration, session setup, route registration, fallback handlers.
- [`config/appConfig.js`](./config/appConfig.js)
  - Centralized env parsing + critical config validation.
- [`middleware/auth.middleware.js`](./middleware/auth.middleware.js)
  - Hard auth + soft auth behavior.
- [`utils/authToken.js`](./utils/authToken.js)
  - Token signing/verification and auth cookie helpers.

## Route Strategy (Canonical + Backward Compatibility)
Canonical production routes now exist alongside legacy aliases to avoid breaking old links.

Examples:
- Affiliate dashboard: `/affiliate/dashboard` (legacy still works via `/a/dashboard`)
- Affiliate link APIs: `/affiliate/links/...`
- Brand campaigns: `/brand/campaigns`
- Wallet: `/affiliate/wallet`
- Payout requests: `/affiliate/payout-requests`
- Admin campaigns: `/admin/campaigns`
- Admin payouts: `/admin/payout-requests`

## Security and Production Notes
- Express `x-powered-by` header disabled.
- Security headers applied globally.
- HTTPS redirect enforced in production behind proxy.
- Auth/contact/shorten endpoints protected by rate limits.
- Session cookies use `httpOnly`, `sameSite=lax`, and `secure` in production.
- Startup fails fast if critical config is missing.

## Developer Onboarding Tips
1. Read [`server.js`](./server.js) first to understand app flow.
2. Then inspect middleware in this order:
   - [`middleware/auth.middleware.js`](./middleware/auth.middleware.js)
   - [`middleware/planLimit.middleware.js`](./middleware/planLimit.middleware.js)
   - [`middleware/admin.middleware.js`](./middleware/admin.middleware.js)
3. For business flows:
   - User/Auth: [`controllers/userControllers.js`](./controllers/userControllers.js)
   - Short links: [`controllers/urlControllers.js`](./controllers/urlControllers.js)
   - Affiliate: [`controllers/affiliateControllers.js`](./controllers/affiliateControllers.js)
   - Wallet/Payout: [`controllers/payoutControllers.js`](./controllers/payoutControllers.js)
   - Admin: [`controllers/adminController.js`](./controllers/adminController.js)

## Scripts
- `npm run dev` -> nodemon development server
- `npm start` -> production server
- `npm run check` -> quick syntax check for `server.js`

## License
ISC
