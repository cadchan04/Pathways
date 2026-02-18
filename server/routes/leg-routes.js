const express = require('express');
const Trip = require('../models/Trip');

const router = express.Router({ mergeParams: true });

// Get all legs for a route
router.get('/', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const route = trip.routes.id(req.params.routeId);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json(route.legs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;