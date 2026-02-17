require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// ROUTES IMPORTS
const exampleRoute = require('./routes/example-route.js');
const routesRoute = require('./routes/routes-route.js');

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { dbName: 'pathways' })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(process.env.PORT || 8080, () => {
  console.log(`Server is running on port ${process.env.PORT || 8080}`);
});

// ROUTES
app.use('/api/example', exampleRoute); //examples route functions
app.use('/api/routes', routesRoute);

// Define a simple route - DELETE THIS LATER
app.get('/api-test', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});