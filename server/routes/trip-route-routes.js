const express = require('express');
const Trip = require('../models/Trip');
const { checkAndSendPriceChangeNotifications } = require('../services/notifications-service');

const router = express.Router({ mergeParams: true });

// Add a new route to a trip
router.post('/', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        const costBefore = Number(trip.totalCost) || 0;

       console.log("Received request to add route with data for trip:", req.params.tripId, req.body)
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
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(trip.routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:routeId', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
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