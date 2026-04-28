const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip.js');
const User = require('../models/User.js');
const {
    actorNameFromUser,
    addTripHistoryEntry,
    buildTripFieldChanges,
} = require('../services/trip-changelog-service.js');
const {
    userIdString,
    canViewTrip,
    canManageTrip,
    canEditTrip,
    canDuplicateTrip,
    isCollaborator,
    readUserId,
} = require('../collaboration/tripAccess');

function getTripNameBase(name) {
    const trimmed = String(name || '').trim();
    const m = trimmed.match(/^(.*)\s\((\d+)\)$/);
    if (m) return m[1].trim();
    return trimmed;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function countTripsInNameFamily(owner, baseName) {
    const escaped = escapeRegex(baseName);
    const regex = new RegExp(`^${escaped}( \\(\\d+\\))?$`);
    return Trip.countDocuments({ owner, name: { $regex: regex } });
}

function cloneRoutesForDuplicate(routes) {
    return routes.map((route) => {
        const obj = route.toObject ? route.toObject({ versionKey: false }) : { ...route };
        delete obj._id;
        if (Array.isArray(obj.legs)) {
            obj.legs = obj.legs.map((leg) => {
                const lo = leg.toObject ? leg.toObject({ versionKey: false }) : { ...leg };
                delete lo._id;
                return lo;
            });
        }
        return obj;
    });
}

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

// GET route to fetch trips owned by or shared with a user
router.get('/', async (req, res) => {
    const userId = readUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'userId is required' });
    }

    try {
        const uid = userIdString(userId);
        const trips = await Trip.find({
            $or: [
                { owner: uid },
                { collaboratorIds: uid },
                { 'collaborators.userId': uid },
            ],
        });

        res.status(200).json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

// POST duplicate trip
router.post('/:id/duplicate', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const source = await Trip.findById(req.params.id);
        if (!source) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        if (!canDuplicateTrip(source, userId)) {
            return res.status(403).json({ error: 'You do not have permission to duplicate this trip' });
        }

        const newOwnerId = userIdString(userId);
        const baseName = getTripNameBase(source.name);
        const count = await countTripsInNameFamily(newOwnerId, baseName);
        const newName = `${baseName} (${count + 1})`;

        const now = new Date();
        const duplicated = new Trip({
            owner: newOwnerId,
            name: newName,
            description: source.description,
            startDate: source.startDate,
            endDate: source.endDate,
            collaboratorIds: [],
            collaborators: [],
            routes: cloneRoutesForDuplicate(source.routes || []),
            createdAt: now,
            updatedAt: now
        });

        const saved = await duplicated.save();
        res.status(201).json(saved);
    } catch (err) {
        console.error('Error duplicating trip:', err);
        res.status(500).json({ error: 'Failed to duplicate trip' });
    }
});

// Collaborator removes trip from their list only, but does not delete the trip for the owner
router.post('/:id/leave', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.id);
        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        if (canManageTrip(trip, userId)) {
            return res.status(400).json({
                error: 'Trip owners cannot leave their trip this way. Delete the trip if you want it removed.',
            });
        }

        if (!isCollaborator(trip, userId)) {
            return res.status(403).json({ error: 'You are not a collaborator on this trip' });
        }

        const uid = userIdString(userId);
        await Trip.findByIdAndUpdate(trip._id, {
            $pull: { collaboratorIds: uid, collaborators: { userId: uid } },
        });

        res.status(200).json({ message: 'Trip removed from your list' });
    } catch (err) {
        console.error('Error leaving trip:', err);
        res.status(500).json({ error: 'Failed to leave trip' });
    }
});

// GET a single trip by its ID (owner or collaborator only)
router.get('/:id', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.id);

        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        if (!canViewTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have access to this trip' });
        }

        res.status(200).json(trip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

// GET chronological edit history for a trip (owner or collaborator only)
router.get('/:id/changelog', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.id).select('editHistory owner collaboratorIds collaborators');
        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        if (!canViewTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have access to this trip' });
        }

        const history = [...(trip.editHistory || [])].sort((a, b) => (
            new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
        ));

        res.status(200).json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a trip by ID (owner only)
router.delete('/:id', async(req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.id);
        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        if (!canManageTrip(trip, userId)) {
            return res.status(403).json({ error: 'Only the trip owner can delete this trip' });
        }

        await Trip.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Trip deleted successfully" });
    } catch (err) {
        console.error("Error deleting trip: ", err);
        res.status(500).json({ error: "Failed to delete trip" });
    }
});

// Edit a trip by id (owner or editor)
router.put('/:id', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const { id } = req.params;
        const trip = await Trip.findById(id);
        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }
        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to edit this trip' });
        }

        const updatePayload = { ...req.body };
        delete updatePayload._id;
        delete updatePayload.editHistory;
        delete updatePayload.priceAlerts;
        if (!canManageTrip(trip, userId)) {
            delete updatePayload.owner;
            delete updatePayload.collaboratorIds;
            delete updatePayload.collaborators;
        }

        const changes = buildTripFieldChanges(trip.toObject(), updatePayload);
        Object.assign(trip, updatePayload);
        trip.updatedAt = new Date();

        if (changes.length > 0) {
            const actor = await User.findById(userId).catch(() => null);
            addTripHistoryEntry(trip, {
                userId,
                userName: actorNameFromUser(actor, userId),
                action: 'trip_updated',
                summary: `Updated ${changes.map((change) => change.label.toLowerCase()).join(', ')}`,
                changes,
            });
        }

        const updatedTrip = await trip.save();

        res.status(200).json(updatedTrip);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch('/:id/alerts/:alertId/read', async (req, res) => {
    try {
      const userId = readUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'userId is required' });
      }

      const trip = await Trip.findById(req.params.id);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
      if (!canViewTrip(trip, userId)) {
        return res.status(403).json({ error: 'You do not have access to this trip' });
      }

      const alert = trip.priceAlerts.id(req.params.alertId);
      if (!alert) return res.status(404).json({ error: 'Alert not found' });

      alert.read = true;
      await trip.save();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
// Edit a route in a trip
router.put('/:tripId/routes/:routeId/update', async (req, res) => {
    try {
        console.log("Received request to update route");
        const { tripId, routeId } = req.params;
        const { _id, ...cleanData } = req.body;

        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to edit routes on this trip' });
        }

        const route = trip.routes.id(routeId);
        if (!route) {
            return res.status(404).json({ message: "Route not found" });
        }

        const actor = await User.findById(userId).catch(() => null);
        const routeName = route.name || cleanData.name || 'route';

        Object.assign(route, cleanData);
        addTripHistoryEntry(trip, {
            userId,
            userName: actorNameFromUser(actor, userId),
            action: 'route_updated',
            summary: `Updated route: ${routeName}`,
            changes: [],
        });
        await trip.save();

        res.status(200).json(route);
    } catch (err) {
        console.error("Error updating route:", err);
        res.status(400).json({ error: "Failed to update route" });
    }
});

router.patch('/:tripId/packing-list', async (req, res) => {
    try {
      const { tripId } = req.params;
      const { packingList } = req.body;

      const userId = readUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'userId is required' });
      }

      const trip = await Trip.findById(tripId);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });

      if (!canEditTrip(trip, userId)) {
        return res.status(403).json({ error: 'You do not have permission to edit the packing list' });
      }

      trip.packingList = packingList;
      await trip.save();

      res.json({ packingList: trip.packingList });
    } catch (err) {
      console.error('Error updating packing list:', err);
      res.status(500).json({ error: 'Could not update packing list' });
    }
  });
  
module.exports = router;
