require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { auth } = require('express-oauth2-jwt-bearer');

// ROUTE IMPORTS
const exampleRoute = require('./routes/example-route.js');
const tripRouteRoute = require('./routes/trip-route-routes.js');
const routesRoute = require('./routes/routes-route.js');
const legRoute = require('./routes/leg-routes.js');
const userRoute = require('./routes/user-routes.js');
const tripRoute = require('./routes/trip-routes.js');

const app = express();

// app.use(cors({ origin: "http://localhost:5173" }));
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { dbName: 'pathways' })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(process.env.PORT || 8080, () => {
  console.log(`Server is running on port ${process.env.PORT || 8080}`);
});

// Define a simple route - DELETE THIS LATER
app.get('/api-test', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

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

/* ROUTES */
app.use('/api/example', exampleRoute); //examples route functions
app.use('/api/trips/:tripId/routes', tripRouteRoute); //trip route route functions - handles adding/getting/editing routes for a specific trip
app.use('/api/trips/:tripId/routes/:routeId/legs', legRoute); //route leg functions
app.use('/api/routes', routesRoute);
app.use('/api/trips', tripRoute); // trip route functions
app.use('/api/user', userRoute);

mongoose.connect(process.env.MONGO_URI, { dbName: 'pathways' })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.listen(8080, () => console.log("Server running on port 8080"));