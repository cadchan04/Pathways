const express = require('express');
const Trip = require('../models/Trip');
const { canViewTrip, canManageTrip, readUserId } = require('../collaboration/tripAccess');

const router = express.Router({ mergeParams: true });

// Get all legs for a route
router.get('/', async (req, res) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'userId is required' });
    }

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (!canViewTrip(trip, userId)) {
      return res.status(403).json({ error: 'You do not have access to this trip' });
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