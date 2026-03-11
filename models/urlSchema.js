const mongoose = require("mongoose");


const urlSchema = new mongoose.Schema(
    {
        orginalUrl: {
            type: String,
            required: true,
        },

        shortUrl: {
            type: String,
            required: true,
            unique: true,
        },
    },
    {
        timestamps: true,
    },
);

module.exports=mongoose.model("Url",urlSchema)