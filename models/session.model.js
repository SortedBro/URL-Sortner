const mongoose = require('mongoose');


const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    refressTokenHash:{
        type: String,
        required: true
    },
    ip:{
        type: String,
        required: true
    },
    revoked:{
        type: Boolean,
        default: false
    },
    userAgent:{
        type: String,
        required: true
    },
   
    
} , {timestamps: true})

module.exports = mongoose.model('Session', sessionSchema);