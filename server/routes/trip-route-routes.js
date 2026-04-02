const express = require('express');
const Trip = require('../models/Trip');
const { checkAndSendPriceChangeNotifications } = require('../services/notifications-service');
const { canViewTrip, canManageTrip, readUserId } = require('../collaboration/tripAccess');

const router = express.Router({ mergeParams: true });

// Add a new route to a trip
router.post('/', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (!canManageTrip(trip, userId)) {
            return res.status(403).json({ error: 'Only the trip owner can add routes' });
        }

        const costBefore = Number(trip.totalCost) || 0;
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

        trip.lastKnownCost = costBefore;
        await trip.save();
        console.log("Updated Trip with new route:", trip.name, req.body.name)
        res.status(201).json(trip);
        checkAndSendPriceChangeNotifications().catch(console.error);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all routes for a trip
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
    res.json(trip.routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:routeId', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (!canManageTrip(trip, userId)) {
            return res.status(403).json({ error: 'Only the trip owner can delete routes' });
        }
        const route = trip.routes.id(req.params.routeId);
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }

        const costBefore = Number(trip.totalCost) || 0;
        route.deleteOne();

        trip.lastKnownCost = costBefore;
        await trip.save();
        console.log("Deleted route:", route.name, "from trip:", trip.name)
        res.json({ message: 'Route deleted successfully' });
        checkAndSendPriceChangeNotifications().catch(console.error);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;