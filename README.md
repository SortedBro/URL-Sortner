# URL-Sortner
# 🔗 URL Shortener - https://url-sortner-oxgz.onrender.com

A simple and fast **URL Shortener Web Application** built using **Node.js, Express, and MongoDB**.
It allows users to convert long URLs into short, shareable links.

---

## 🚀 Features

* Generate short URLs from long links
* Redirect short URL to the original URL
* Store URLs in MongoDB database
* Simple REST API
* Unique short code generation
* Scalable backend structure

---

## 🛠 Tech Stack

**Backend**

* Node.js
* Express.js

**Database**

* MongoDB
* Mongoose

**Tools**

* Git & GitHub
* Postman (for API testing)

---

## 📁 Project Structure

```
url-shortener
│
├── models
│   └── url.js
│
├── routes
│   └── urlRoutes.js
│
├── controllers
│   └── urlController.js
│
├── config
│   └── db.js
│
├── server.js
├── package.json
└── README.md
```

---

## ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/yourusername/url-shortener.git
```

Go to the project folder

```bash
cd url-shortener
```

Install dependencies

```bash
npm install
```

Start the server

```bash
npm start
```

Server will run on

```
http://localhost:5000
```

---

## 📡 API Endpoints

### Create Short URL

```
POST /shorten
```

Request Body

```json
{
  "url": "https://example.com"
}
```

Response

```json
{
  "shortUrl": "http://localhost:5000/abc123"
}
```

---

### Redirect URL

```
GET /:shortId
```

Redirects to the original URL.

Example

```
http://localhost:5000/abc123
```

---

## 🧠 How It Works

1. User submits a long URL.
2. Server generates a unique **short ID**.
3. URL + short ID are stored in MongoDB.
4. When the short link is visited, server redirects to the original URL.

---

## 📌 Future Improvements

* Click analytics
* Expiration time for links
* Custom short URLs
* User authentication
* Admin dashboard

---

## 👨‍💻 Author

Developed by **[SolLCoder]**

---

## ⭐ Support

If you like this project, please **star the repository** ⭐
