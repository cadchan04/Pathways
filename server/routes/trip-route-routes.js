const express = require('express');
const Trip = require('../models/Trip');

const router = express.Router({ mergeParams: true });

// Add a new route to a trip
router.post('/', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        trip.routes.push({
            name: req.body.name,
            origin: req.body.origin,
            destination: req.body.destination,
            departAt: req.body.departAt,
            arriveAt: req.body.arriveAt,
            legs: req.body.legs,
            totalCost: req.body.totalCost,
            totalDuration: req.body.totalDuration,
            totalDistance: req.body.totalDistance
        });
        await trip.save();
        //console.log("Updated Trip with new route:", trip)
        res.status(201).json(trip);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all routes for a trip
router.get('/', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(trip.routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;