const express = require('express');
const Accommodation = require('../models/Accommodation');
const Trip = require('../models/Trip');
const { canViewTrip, canEditTrip, readUserId } = require('../collaboration/tripAccess');
const {
    actorLabel,
    appendCollaborationAlerts,
} = require('../services/collaboration-notifications-service');

const router = express.Router({ mergeParams: true });

// POST method to create a new accommodation
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
        return res.status(403).json({ error: 'You do not have permission to add accommodations on this trip' });
    }

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
       // const savedAccommodation = await newAccommodation.save();
        const newTotalCost = (trip.totalCost || 0) + (Number(cost) || 0);
        const [savedTrip, savedAccommodation] = await Promise.all([
                Trip.findByIdAndUpdate(trip._id, {
                        $set: { 
                            totalCost: newTotalCost,
                            updatedAt: new Date() }
                    },  { returnDocument: "after", runValidators: true }),
                newAccommodation.save()
            ]);

        const actorName = await actorLabel(userId);
        const message = `${actorName} added accommodation "${savedAccommodation.name}" to ${trip.name}.`;
        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'accommodation_added',
            message,
            metadata: {
                tripId: String(trip._id),
                accommodationId: String(savedAccommodation._id),
                accommodationName: savedAccommodation.name,
            },
        });
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
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (!canViewTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have access to this trip' });
        }

        const accommodations = await Accommodation.find({ tripId });
        res.json(accommodations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE method to remove an accommodation by its ID
router.delete('/:accId', async (req, res) => {
    const { tripId, accId } = req.params;

    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to delete accommodations on this trip' });
        }

        const existing = await Accommodation.findById(accId);
        if (!existing) {
            return res.status(404).json({ error: 'Accommodation not found' });
        }
        if (String(existing.tripId) !== String(tripId)) {
            return res.status(400).json({ error: 'Accommodation does not belong to this trip' });
        }

        const deletedName = existing.name;

         const accToDelete = await Accommodation.findOne({ _id: accId, tripId });
        if (!accToDelete) {
            return res.status(404).json({ error: 'Accommodation not found' });
        }

        // Update the trip's cost
        const newTotalCost = (trip.totalCost || 0) - (accToDelete.cost || 0);
        console.log(`Deleting accommodation with cost ${accToDelete.cost}, total cost now: ${newTotalCost}`);

            const [savedTrip] = await Promise.all([
                Trip.findByIdAndUpdate(trip._id, {
                        $set: { 
                            totalCost: newTotalCost,
                            updatedAt: new Date() 
                        }
                    },  { returnDocument: "after", runValidators: true }),
                accToDelete.deleteOne()
            ]);

        const actorName = await actorLabel(userId);
        const message = `${actorName} removed accommodation "${deletedName}" from ${trip.name}.`;
        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'accommodation_deleted',
            message,
            metadata: {
                tripId: String(trip._id),
                accommodationId: String(existing._id),
                accommodationName: deletedName,
            },
        });
        res.json({ message: 'Accommodation deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;