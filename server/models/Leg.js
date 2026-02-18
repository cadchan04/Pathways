const mongoose = require('mongoose');
const { locationSchema } = require('./Location');

const legSchema = new mongoose.Schema({
  transportationMode: { type: String, required: true },
  origin: { type: locationSchema, required: true },
  destination: { type: locationSchema, required: true },
  departAt: { type: Date, required: true },
  arriveAt: { type: Date, required: true },
  cost: { type: Number, required: true },
  duration: { type: Number, required: true }, // duration in minutes
  distance: { type: Number, required: true },
  provider: { type: String } // Optional: e.g., airline, bus company, etc.
  /*geometry: {
    type: { type: String, enum: ['LineString'], required: true },
    coordinates: { type: [[Number]], required: true } // Array of [lng, lat] pairs
  },*/ // Optional: Include geometry for mapping purposes but we can clear the routes in database and add this later if we want to use it
});

const Leg = mongoose.model('Leg', legSchema);
module.exports = { Leg, legSchema };