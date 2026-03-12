const Url = require('../models/urlSchema')
const { nanoid } = require('nanoid')

exports.createShortUrl = async (req, res) => {




    const { orginalUrl } = req.body;
    const shortCode = nanoid(6);
    const existingUrl = await Url.findOne({ orginalUrl })
    
    if (existingUrl) {
        
        const shortUrl = `http://localhost:${process.env.PORT}/${existingUrl.shortCode}`
        return res.render('home',{shortUrl})
        
    }
    
    
        const shortUrl = `http://localhost:${process.env.PORT}/${shortCode}`
    
    
    const url = await Url.create({
        orginalUrl,
        shortCode, 
        shortUrl,
        
    })
    
    // res.json({
    //     shortUrl: `http://localhost:${process.env.PORT}/${shortCode}`
    // })
   
        res.render(
            "home",{shortUrl}
        )


}

exports.redirectUrl = async (req, res) => {
    const url = await Url.findOne({
        shortCode: req.params.code
    })



    if (!url) {
        return res.status(404).json({ message: "Url not found" })
    }

    res.redirect(url.orginalUrl)
}