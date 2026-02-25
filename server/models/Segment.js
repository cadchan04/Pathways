const mongoose = require('mongoose');
const { locationSchema } = require('./Location');

const segmentSchema = new mongoose.Schema({
  origin: { type: locationSchema, required: true },
  destination: { type: locationSchema, required: true },
  departAt: { type: Date, required: true },
  arriveAt: { type: Date, required: true },
  duration: { type: Number, required: true }, // duration in minutes
  distance: { type: Number, default: 0 },
  provider: { type: String } // Optional: e.g., airline, bus company, etc.
}, { _id: false });

const Segment = mongoose.model('Segment', segmentSchema);
module.exports = { Segment, segmentSchema };