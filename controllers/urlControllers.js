const Url = require('../models/urlSchema')
const {nanoid}=require('nanoid')

exports.createShortUrl= async(req,res)=>{


    const {orginalUrl} = req.body;
    const shortCode = nanoid(6);

    const url = await Url.create({
        orginalUrl,
        shortCode
    })

res.json({
    shortUrl:`http://localhost:${process.env.PORT}/${shortCode}`
})


}

exports.redirectUrl=async (req,res)=>{
    const url = await Url.findOne({
        shortCode:req.params.code
    })


    if(!url){
        return res.status(404).json({message:"Url not found"})
    }

    res.redirectUrl(url.orginalUrl)
}