const mongoose = require("mongoose");


const urlSchema = new mongoose.Schema(
    {
        orginalUrl: {
            type: String,
            required: true,
        },

        shortCode: {
            type: String,
            required: true,
            unique: true,
        },
        shortUrl:{
            type:String,
            require:true,
            unique: true,


        }
    },
    {
        timestamps: true,
    },
);

module.exports=mongoose.model("Url",urlSchema)