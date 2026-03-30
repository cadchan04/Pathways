const mongoose = require('mongoose');
const { locationSchema } = require('./Location');
const { segmentSchema } = require('./Segment');

const legSchema = new mongoose.Schema({
  transportationMode: { type: String, required: true },
  origin: { type: locationSchema, required: true },
  destination: { type: locationSchema, required: true },
  departAt: { type: Date, required: true },
  arriveAt: { type: Date, required: true },
  segments: [{ type: segmentSchema, default: [] }],
  cost: { type: Number, default: null },
  duration: { type: Number, required: true },
  distance: { type: Number, required: true },
  provider: { 
    type: mongoose.Schema.Types.Mixed, // ✅ accepts both string and array
    default: []
  }
});

const Leg = mongoose.model('Leg', legSchema);
module.exports = { Leg, legSchema };