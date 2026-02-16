const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
    owner: { type: String, required: true }, // will be user ID of the trip creator
    name: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    collaboratorIds: [{ type: String }], // array of user IDs who are collaborators
    // routes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Route' }], // will be array of route IDs
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Trip = mongoose.model('Trip', TripSchema);

module.exports = Trip;