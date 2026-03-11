const express = require('express');
const mongoose = require('mongoose')
const{createShortUrl}=require('./controllers/urlControllers')
const connectDB=require('./config/db')
require('dotenv').config();



const port=process.env.PORT;
const app = express();

connectDB();




app.use(express.json())
app.use(express.urlencoded({ extended:true }))
app.set('view engine','ejs');




app.get("/",(req,res)=>{
    res.render('home')
    // res.json({m:'This is the end'})
})

app.post('/sorten',createShortUrl)



app.listen(port , ()=>{
    console.log(`Server is running at ${port}`)
})