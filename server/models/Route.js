const mongoose = require('mongoose');
const Location = require('./Location');
const Leg = require('./Leg');

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  origin: { type: Location, required: true },
  destination: { type: Location, required: true },
  departAt: { type: Date, required: true },
  arriveAt: { type: Date, required: true },
  legs: [{ type: Leg, required: true }],
  totalCost: { type: Number, required: true },
  totalDuration: { type: Number, required: true }, // duration in minutes
  totalDistance: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Route = mongoose.model('Route', routeSchema);

module.exports = Route;