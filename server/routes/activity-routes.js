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

router.get('/:activityId', async (req, res) => {
    const { tripId, activityId } = req.params;

    if (!tripId || !activityId) {
        return res.status(400).json({ error: 'Missing tripId or activityId parameters' });
    }

    try {
        const activity = await Activity.findOne({ _id: activityId, tripId });

        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        res.json(activity);
    } catch (err) {
        console.error("Mongoose Find Error:", err.message);
        res.status(500).json({ error: 'Server error while fetching activity' });
    }
});

router.put('/:activityId', async (req, res) => {
    const { tripId, activityId } = req.params;
    const updateData = req.body;

    if (!tripId || !activityId) {
        return res.status(400).json({ error: 'Missing tripId or activityId parameters' });
    }

    try {
        const updatedActivity = await Activity.findOneAndUpdate(
            { _id: activityId, tripId },
            updateData,
            { returnDocument: 'after' }
        );

        if (!updatedActivity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        res.json(updatedActivity);
    } catch (err) {
        console.error("Mongoose Update Error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;