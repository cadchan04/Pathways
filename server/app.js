require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { auth } = require('express-oauth2-jwt-bearer');

const exampleRoute = require('./routes/example-route.js');
const userRoute = require('./routes/user.js');

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Login APIs
const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
});

// Public route
app.get("/", (req, res) => {
  res.send("API is running");
});

// Protected route
app.get("/protected", checkJwt, (req, res) => {
  res.json({ message: "You accessed a protected route!" });
});

// User sync
app.use('/api/user', userRoute);

mongoose.connect(process.env.MONGO_URI, { dbName: 'pathways' })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.listen(8080, () => console.log("Server running on port 8080"));
