const Url = require('../models/urlSchema')
const { nanoid } = require('nanoid')


// Create short Url 

exports.createShortUrl = async (req, res) => {
     console.log("1. req.cookies:", req.cookies)
    console.log("2. req.user:", req.user)
    console.log("3. ENV secret:", process.env.jwt_secret)


    try {


        const { orginalUrl, customAlias } = req.body;

        if (!orginalUrl) {
            return res.render('home', { error: "Url daalna zaroori hai" })
        }
        if (customAlias) {
            const aliasExists = await Url.findOne({ shortCode: customAlias });
            if (aliasExists) {
                return res.render('home', {
                    error: "Ye alias already le liya gaya hai ",
                    shortUrl: null
                })
            }
        }

        console.log('custom code -', customAlias)
        const existingUrl = await Url.findOne({ orginalUrl })

        if (existingUrl) {
            const shortUrl = `${req.protocol}://${req.get("host")}/${existingUrl.shortCode}`;
            return res.render('home', { shortUrl, error: null })

        }


        const shortCode = customAlias || nanoid(6);
        const shortUrl = `${req.protocol}://${req.get("host")}/${shortCode}`;


        await Url.create({
            orginalUrl,
            shortCode,
            shortUrl,
            createdBy: req.user?.user ?? null,

        })
        res.render(
            "home", { shortUrl, error: null }
        )

    } catch (error) {
        console.log(error);
        res.render("home", { error: "Kuch gadbad hui", shortUrl: null })

    }
}

//RedirectUrl 

exports.redirectUrl = async (req, res) => {

    try {
        const url = await Url.findOne({
            shortCode: req.params.code
        })
        if (!url) {
            return res.status(404).render('404');
        }

        // ✅ click count 
        url.clicks += 1;
        url.lastClickedAt = new Date();

        await url.save();
        res.redirect(url.orginalUrl)

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server Error" })

    }





}

exports.deleteUrl = async (req, res) => {
    try {
        const url = await Url.findOne({
            shortCode: req.params.code,
            createdBy: req.user.user,
        });

        if (!url) {
            return res.status(404).json({ message: "URL naji mili ya nahi hai" })
        }

        await url.deleteOne();
        res.redirect('/dashboard');



    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" })


    }
}



exports.serverOn = (req, res) => {
    res.json({ message: "Server is on" });

}