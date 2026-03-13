const Contact = require('../models/contactSchema.js')


exports.handleContact = async (req, res) => {

    const { name, email, message } = req.body;

    try {
        const contact = await Contact.create({
            name,
            email,
            message
        })

        return res.render("about", {
            success: '✅ Message sent successfully!',
            error: null
        })

    } catch (error) {
        console.log(error)

    }


}