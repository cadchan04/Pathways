const express = require('express');
const Accommodation = require('../models/Accommodation');

const router = express.Router({ mergeParams: true });

// POST method to create a new accommodation
router.post('/', async (req, res) => {
    const { tripId } = req.params; 
    
    const {
        name,
        type,
        address,
        phoneNumber,
        email,
        website,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        confirmationNumber,
        cost,
        isPaid,
        notes,
        owner
    } = req.body;

    if (!tripId || !owner) {
        return res.status(400).json({ error: 'Missing tripId or owner fields' });
    }

    const newAccommodation = new Accommodation({
        name,
        type,
        address,
        phoneNumber,
        email,
        website,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        confirmationNumber,
        cost,
        isPaid,
        notes,
        tripId,
        owner
    });

    try {
        const savedAccommodation = await newAccommodation.save();
        res.status(201).json(savedAccommodation);
    } catch (err) {
        console.error("Mongoose Save Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

// GET method to retrieve all accommodations for the trip
router.get('/', async (req, res) => {
    const { tripId } = req.params;

    try {
        const accommodations = await Accommodation.find({ tripId });
        res.json(accommodations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;