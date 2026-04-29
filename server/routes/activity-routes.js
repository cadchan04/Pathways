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
        const newTotalCost = (trip.totalCost || 0) + (Number(cost) || 0);
        const [savedTrip, savedActivity] = await Promise.all([
                Trip.findByIdAndUpdate(trip._id, {
                        $set: { 
                            totalCost: newTotalCost,
                            updatedAt: new Date() }
                    },  { returnDocument: "after", runValidators: true }),
                newActivity.save()
            ]);
        res.status(201).json({ trip: savedTrip, activity: savedActivity });
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
        const activityToUpdate = await Activity.findOne({ _id: activityId, tripId });
        if (!activityToUpdate) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        let newTotalCost = 0;
        if (updateData.cost !== undefined) {
            const oldCost = activityToUpdate.cost || 0;
            const newCost = Number(updateData.cost) || 0;
            newTotalCost = (trip.totalCost || 0) - oldCost + newCost;
            console.log(`Updating activity cost from ${oldCost} to ${newCost}, total cost now: ${newTotalCost}`);
        }

        Object.assign(activityToUpdate, updateData);

        const [savedTrip, savedActivity] = await Promise.all([
            Trip.findByIdAndUpdate(trip._id, {
                    $set: { 
                        totalCost: newTotalCost,
                        updatedAt: new Date() 
                    }
                },  { returnDocument: "after", runValidators: true }),
            activityToUpdate.save()
        ]);

        const actorName = await actorLabel(userId);
                const message = `${actorName} added activity "${savedActivity.name}" to ${trip.name}.`;
                await appendCollaborationAlerts({
                    trip,
                    actorUserId: userId,
                    type: 'activity_added',
                    message,
                    metadata: {
                        tripId: String(trip._id),
                        activityId: String(savedActivity._id),
                        activityName: savedActivity.name,
                    },
                });

        res.json({ trip: savedTrip, activity: savedActivity });
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
        const activityToDelete = await Activity.findOne({ _id: activityId, tripId });
        if (!activityToDelete) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        // Update the trip's cost
        const newTotalCost = (trip.totalCost || 0) - (activityToDelete.cost || 0);
        console.log(`Deleting activity with cost ${activityToDelete.cost}, total cost now: ${newTotalCost}`);

         const [savedTrip] = await Promise.all([
                Trip.findByIdAndUpdate(trip._id, {
                        $set: { 
                            totalCost: newTotalCost,
                            updatedAt: new Date() 
                        }
                    },  { returnDocument: "after", runValidators: true }),
                activityToDelete.deleteOne()
            ]);

        const actorName = await actorLabel(userId);
        const message = `${actorName} removed activity "${activityToDelete.name}" from ${trip.name}.`;
        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'activity_deleted',
            message,
            metadata: {
                tripId: String(trip._id),
                activityId: String(activityToDelete._id),
                activityName: activityToDelete.name,
            },
        });

        res.json({ trip: savedTrip, message: 'Activity deleted successfully' });
    } catch (err) {
        console.error("Mongoose Delete Error:", err.message);
        res.status(500).json({ error: 'Server error while deleting activity' });
    }
});

module.exports = router;