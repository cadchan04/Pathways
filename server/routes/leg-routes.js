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

// Update a leg within a route
router.patch('/:legId', async (req, res) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'userId is required' });
    }

    console.log("Received request to update leg with data:", req.body)

    //find the trip, route, and leg based on the IDs in the request params
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (!canManageTrip(trip, userId)) {
      return res.status(403).json({ error: 'Only the trip owner can edit route legs' });
    }
    const route = trip.routes.id(req.params.routeId);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    const leg = route.legs.id(req.params.legId);
    if (!leg) {
      return res.status(404).json({ error: 'Leg not found' });
    }

    // Update leg fields based on request body
    leg.set(req.body);

    //recalculate route totals based on updated leg details
    route.totalCost = route.legs.reduce((total, leg) => total + (leg.cost || 0), 0);
    route.totalDuration = route.legs.reduce((total, leg) => total + (leg.duration || 0), 0);
    route.totalDistance = route.legs.reduce((total, leg) => total + (leg.distance || 0), 0);

    //redo route origin/destination/depart/arrival based on updated leg details 
    route.origin = route.legs[0].origin;
    route.departAt = route.legs[0].departAt;
    const lastLeg = route.legs[route.legs.length - 1];
    route.destination = lastLeg.destination;
    route.arriveAt = lastLeg.arriveAt;

    // Update route name
    route.name = `${route.origin.name} to ${route.destination.name} route`;

    //Update route update time
    route.updatedAt = new Date();

    //Update trip update time
    trip.updatedAt = new Date();

    await trip.save();
    console.log("Updated Trip after leg update:", trip)
    res.json(leg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;