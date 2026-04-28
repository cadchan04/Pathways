const express = require('express');
const Activity = require('../models/Activity');
const Trip = require('../models/Trip');
const { canViewTrip, canEditTrip, readUserId } = require('../collaboration/tripAccess');

const router = express.Router({ mergeParams: true });

// POST method to create a new activity
router.post('/', async (req, res) => {
    const { tripId } = req.params;

    const userId = readUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'userId is required' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
    }
    if (!canEditTrip(trip, userId)) {
        return res.status(403).json({ error: 'You do not have permission to add activities on this trip' });
    }

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

    const userId = readUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'userId is required' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
    }
    if (!canViewTrip(trip, userId)) {
        return res.status(403).json({ error: 'You do not have permission to view activities on this trip' });
    }

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
    const userId = readUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'userId is required' });
    }

    if (!tripId || !activityId) {
        return res.status(400).json({ error: 'Missing tripId or activityId parameters' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
    }
    if (!canViewTrip(trip, userId)) {
        return res.status(403).json({ error: 'You do not have permission to view activities on this trip' });
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
    const userId = readUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'userId is required' });
    }

    if (!tripId || !activityId) {
        return res.status(400).json({ error: 'Missing tripId or activityId parameters' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
    }
    if (!canEditTrip(trip, userId)) {
        return res.status(403).json({ error: 'You do not have permission to edit activities on this trip' });
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

router.delete('/:activityId', async (req, res) => {
    const { tripId, activityId } = req.params;
    const userId = readUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'userId is required' });
    }

    if (!tripId || !activityId) {
        return res.status(400).json({ error: 'Missing tripId or activityId parameters' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
    }
    if (!canEditTrip(trip, userId)) {
        return res.status(403).json({ error: 'You do not have permission to delete activities on this trip' });
    }

    try {
        const deletedActivity = await Activity.findOneAndDelete({ _id: activityId, tripId });

        if (!deletedActivity) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        res.json({ message: 'Activity deleted successfully' });
    } catch (err) {
        console.error("Mongoose Delete Error:", err.message);
        res.status(500).json({ error: 'Server error while deleting activity' });
    }
});

module.exports = router;