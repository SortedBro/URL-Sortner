const Contact = require('../models/contactSchema');

/**
 * Handles public contact form submissions.
 * We render the about page again so user gets instant success/error feedback.
 */
exports.handleContact = async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const message = String(req.body.message || '').trim();

    try {
        if (!name || !email || !message) {
            return res.render('about', {
                success: null,
                error: 'Please fill all fields before submitting.',
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.render('about', {
                success: null,
                error: 'Please enter a valid email address.',
            });
        }

        await Contact.create({ name, email, message });

        return res.render('about', {
            success: 'Message sent successfully.',
            error: null,
        });
    } catch (error) {
        console.log('Contact submit error:', error);
        return res.render('about', {
            success: null,
            error: 'Could not send your message right now. Please try again.',
        });
    }
};
