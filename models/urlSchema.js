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


        },
          // Phase 1 — analytics

          clicks:{type:Number,default:0},
          lastClickedAt:{type:Date},

          // Phase 2 — dashboard ke liye
          createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"},

            // Phase 3 — control

            expiresAt:{type:Date},
            isActive:{type:Boolean,default:true}

    },
    {
        timestamps: true,
    },
);

module.exports=mongoose.model("Url",urlSchema)