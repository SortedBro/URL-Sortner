const legalLinks = [
    { key: 'privacy', href: '/privacy', label: 'Privacy Policy' },
    { key: 'terms', href: '/terms', label: 'Terms of Service' },
];

const legalPages = {
    privacy: {
        key: 'privacy',
        metaTitle: 'Privacy Policy - SnapLink',
        title: 'Privacy Policy',
        summary:
            'This page explains what information SnapLink collects, how it is used, and what controls users have over their data.',
        effectiveDate: '28 March 2026',
        note:
            'This is a production-ready policy template based on the current product features. Review it with legal counsel before public launch.',
        sections: [
            {
                title: 'Information we collect',
                body: [
                    'SnapLink collects the information needed to run accounts, shorten links, process payments, and provide analytics.',
                    'Some information is provided directly by users, while some is collected automatically when links are created, managed, or opened.',
                ],
                list: [
                    'Account details such as name, email address, password hash, plan, and profile preferences.',
                    'Link data such as destination URLs, aliases, white-label domains, passwords for protected links, expiry settings, and campaign settings.',
                    'Usage and analytics data such as IP address, approximate location, browser, device type, operating system, referrer, and click timestamps.',
                    'Billing and payment metadata received from payment processors for plan upgrades, wallet actions, and payout workflows.',
                ],
            },
            {
                title: 'How we use data',
                body: [
                    'We use collected data to deliver the core SnapLink service, secure the platform, and improve product quality.',
                ],
                list: [
                    'To create, redirect, manage, and analyze short links.',
                    'To authenticate users, prevent abuse, and enforce plan limits.',
                    'To process subscriptions, affiliate earnings, wallet balances, and payout requests.',
                    'To send transactional messages such as OTP verification, onboarding emails, or account notices.',
                ],
            },
            {
                title: 'Cookies and local storage',
                body: [
                    'SnapLink uses cookies and browser storage for login sessions, theme preferences, protected-link unlock state, and other essential product behavior.',
                    'These technologies are used to keep users signed in, remember product preferences, and reduce repeated prompts during normal platform use.',
                ],
            },
            {
                title: 'Analytics and link tracking',
                body: [
                    'When a shortened link is opened, SnapLink may record technical and referral data so account owners can review link performance.',
                    'This can include timestamp, country, city, device family, browser, operating system, and referring source. IP addresses may also be stored for fraud prevention and uniqueness checks.',
                ],
            },
            {
                title: 'Third-party services',
                body: [
                    'SnapLink works with selected third-party providers for infrastructure and business operations, including hosting, database, email delivery, caching, and payment processing.',
                    'These providers only receive the data required for their service and are expected to protect it using appropriate safeguards.',
                ],
            },
            {
                title: 'Data retention',
                body: [
                    'We retain data for as long as it is needed to operate the service, comply with legal obligations, resolve disputes, and enforce platform rules.',
                    'Users may request account deletion, but some records may be retained where necessary for security, finance, fraud review, or legal compliance.',
                ],
            },
            {
                title: 'User rights and controls',
                body: [
                    'Users can update profile details, reset passwords, manage white-label settings, and delete links from their dashboard.',
                    'Requests related to access, correction, or deletion of account data can be submitted through platform support channels.',
                ],
            },
            {
                title: 'Security',
                body: [
                    'SnapLink uses reasonable technical and organizational controls to protect user data, including authentication, hashed passwords, server-side validation, and access restrictions.',
                    'No service can guarantee absolute security, so users should also protect their credentials and use strong passwords.',
                ],
            },
            {
                title: 'Policy updates',
                body: [
                    'This Privacy Policy may be updated when product features, legal requirements, or operational practices change.',
                    'The latest version will be published on this page with an updated effective date.',
                ],
            },
        ],
    },
    terms: {
        key: 'terms',
        metaTitle: 'Terms of Service - SnapLink',
        title: 'Terms of Service',
        summary:
            'These terms govern access to SnapLink, including link shortening, analytics, paid plans, affiliate features, wallet tools, and white-label usage.',
        effectiveDate: '28 March 2026',
        note:
            'This is a product-focused terms template for the current SnapLink platform. Legal review is recommended before launch or commercial rollout.',
        sections: [
            {
                title: 'Acceptance of terms',
                body: [
                    'By accessing or using SnapLink, users agree to follow these Terms of Service and any related platform policies.',
                    'If a user does not agree with these terms, the service should not be used.',
                ],
            },
            {
                title: 'Eligibility and accounts',
                body: [
                    'Users are responsible for providing accurate account information and keeping login credentials secure.',
                    'Each account holder is responsible for all activity performed through their account unless unauthorized access is reported promptly.',
                ],
            },
            {
                title: 'Permitted use',
                body: [
                    'SnapLink may be used to create, manage, and analyze shortened URLs for lawful business, creator, marketing, and operational use cases.',
                ],
                list: [
                    'Users must not create or distribute illegal, fraudulent, abusive, misleading, or malicious links.',
                    'Users must not attempt to disrupt platform security, bypass plan limits, scrape restricted data, or abuse redirect behavior.',
                    'Users are responsible for the content and destination of any link they create through the platform.',
                ],
            },
            {
                title: 'Paid plans and billing',
                body: [
                    'Some features are available only on paid plans, including advanced link controls, higher usage limits, API access, and business features.',
                    'Subscription payments are processed through third-party payment providers. Pricing, billing cycles, and plan benefits may change over time.',
                ],
            },
            {
                title: 'Affiliate, wallet, and payout features',
                body: [
                    'Where affiliate, earning, wallet, or payout tools are enabled, SnapLink may track campaign activity, pending earnings, payout requests, and settlement history.',
                    'SnapLink may hold, adjust, reject, reverse, or delay earnings or payouts where fraud, abuse, chargebacks, invalid traffic, or policy violations are detected.',
                ],
            },
            {
                title: 'White-label and custom domain usage',
                body: [
                    'Business users may configure custom domains, branding, and white-label presentation where those features are included in their plan.',
                    'Users are responsible for ensuring that domains, branding assets, and campaign materials used with SnapLink do not infringe third-party rights.',
                ],
            },
            {
                title: 'Suspension and termination',
                body: [
                    'SnapLink may suspend, limit, or terminate accounts, links, campaigns, affiliate balances, or custom domains where misuse, fraud, non-payment, or legal risk is identified.',
                    'We may also disable or remove links that create platform, legal, reputational, or security risk.',
                ],
            },
            {
                title: 'Service availability',
                body: [
                    'SnapLink aims to provide a stable and reliable service, but uptime, redirect speed, analytics accuracy, and third-party integrations cannot be guaranteed at all times.',
                    'Maintenance, outages, infrastructure issues, and provider failures may affect parts of the platform from time to time.',
                ],
            },
            {
                title: 'Limitation of liability',
                body: [
                    'To the maximum extent permitted by law, SnapLink is not liable for indirect, incidental, special, consequential, or lost-profit damages arising from platform use or unavailability.',
                    'Users remain responsible for the business, legal, and reputational consequences of the links and content they distribute through the platform.',
                ],
            },
            {
                title: 'Changes to these terms',
                body: [
                    'These terms may be updated as the product evolves. Continued use of SnapLink after updates are published means the updated terms are accepted.',
                    'The current version will always be available on this page with an updated effective date.',
                ],
            },
        ],
    },
};

module.exports = {
    legalLinks,
    legalPages,
};
