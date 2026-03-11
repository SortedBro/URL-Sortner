const express = require('express');
const mongoose = require('mongoose')
const connectDB=require('./config/db')
require('dotenv').config();


const port=process.env.PORT;
const app = express();

connectDB();






app.listen(port , ()=>{
    console.log(`Server is running at ${port}`)
})