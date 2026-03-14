const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
require('dotenv').config();
const urlRoutes = require('./routes/urlRoutes')
const path=require('path')


const port = process.env.PORT || 3000;

const app = express();


// database connection
connectDB();

//built in middleware 
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.set('view engine', 'ejs');




// GET routes

app.get("/", (req, res) => { res.render('home', { shortUrl: null, error: null }) })
app.get('/signup', (req, res) => res.render('signup', { error: null, success: null }))
app.get('/login', (req, res) => res.render('login', { error: null, success: null }))
app.get("/about", (req, res) => { res.render("about", { success: null, error: null }) })


// POST routes

app.use('/shorten', urlRoutes)
app.use('/', urlRoutes)



// server listing

app.listen(port, () => {
    console.log(`Server is running at ${port}`)
    console.log(`http://localhost:${port}/`)
})