const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip.js');
const Route = require('../models/Route.js');

// POST route to create a new trip
router.post('/', async (req, res) => {
    try {
        const newTrip = new Trip(req.body);
        const savedTrip = await newTrip.save();
        res.status(201).json(savedTrip);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET route to fetch all trips for a user (replace "mock_user_123" with actual user ID from auth later)
router.get('/', async (req, res) => {
    try {
        const userId = "mock_user_123"; // replace with actual user ID from auth
        const trips = await Trip.find({ owner: userId });

        res.status(200).json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

// GET a single trip by its ID
router.get('/:id', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);

        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        res.status(200).json(trip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

module.exports = router;