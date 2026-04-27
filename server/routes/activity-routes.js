const express = require('express');
const Activity = require('../models/Activity');

const router = express.Router({ mergeParams: true });

// POST method to create a new activity
router.post('/', async (req, res) => {
    const { tripId } = req.params;

    const {
        name,
        activityType,
        address,
        phoneNumber,
        email,
        website,
        activityDate,
        startTime,
        endTime,
        cost,
        notes,
        owner
    } = req.body;

    if (!tripId || !owner) {
        return res.status(400).json({ error: 'Missing tripId or owner fields' });
    }

    const newActivity = new Activity({
        name,
        activityType,
        address,
        phoneNumber,
        email,
        website,
        activityDate,
        startTime,
        endTime,
        cost,
        notes,
        tripId,
        owner
    });

    try {
        const savedActivity = await newActivity.save();
        res.status(201).json(savedActivity);
    } catch (err) {
        console.error("Mongoose Save Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    const { tripId } = req.params;

    if (!tripId) {
        return res.status(400).json({ error: 'Missing tripId parameter' });
    }

    try {
        const activities = await Activity.find({ tripId });
        res.json(activities);
    } catch (err) {
        console.error("Mongoose Find Error:", err.message);
        res.status(500).json({ error: 'Server error while fetching activities' });
    }
});

module.exports = router;