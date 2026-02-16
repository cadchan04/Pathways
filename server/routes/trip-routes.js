const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip.js');

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

module.exports = router;