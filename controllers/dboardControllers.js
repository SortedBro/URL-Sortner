const Url = require('../models/urlSchema')


exports.getDashboard = async (req, res)=>{


    try {
        
    
    const urls = await Url.find({createdBy:req.user.user}).sort({createdBy:-1})

    res.render('dashboard',{urls})

    } catch (error) {

        console.log(error)
        res.status(500).json({message:"Server error"})
        
    }
}