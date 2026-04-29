const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip.js');
const {
    userIdString,
    canViewTrip,
    canManageTrip,
    canEditTrip,
    canDuplicateTrip,
    isCollaborator,
    readUserId,
} = require('../collaboration/tripAccess');
const {
    actorLabel,
    buildTripUpdateMessage,
    appendCollaborationAlerts,
} = require('../services/collaboration-notifications-service');

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
        trip.collaboratorIds = (trip.collaboratorIds || []).filter((id) => userIdString(id) !== uid);
        trip.collaborators = (trip.collaborators || []).filter((c) => userIdString(c.userId) !== uid);
        const actorName = await actorLabel(uid);
        const message = `${actorName} left collaboration on ${trip.name}.`;
        await appendCollaborationAlerts({
            trip,
            actorUserId: uid,
            type: 'collaborator_removed',
            message,
            metadata: { tripId: String(trip._id), collaboratorUserId: uid },
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
        if (!canManageTrip(trip, userId)) {
            delete updatePayload.owner;
            delete updatePayload.collaboratorIds;
            delete updatePayload.collaborators;
        }

        const trackedFields = ['name', 'description', 'startDate', 'endDate'];
        const changedFields = trackedFields.filter((field) => {
            if (!(field in updatePayload)) return false;
            const beforeRaw = trip[field];
            const afterRaw = updatePayload[field];
            const before = beforeRaw instanceof Date ? beforeRaw.toISOString() : String(beforeRaw ?? '');
            const afterDate = (field === 'startDate' || field === 'endDate') && afterRaw ? new Date(afterRaw) : null;
            const after = afterDate instanceof Date && !Number.isNaN(afterDate.getTime())
                ? afterDate.toISOString()
                : String(afterRaw ?? '');
            return before !== after;
        });

        const updatedTrip = await Trip.findByIdAndUpdate(
            id,
            updatePayload,
            { returnDocument: "after", runValidators: true }
        );

        if (changedFields.length > 0) {
            const actorName = await actorLabel(userId);
            const message = buildTripUpdateMessage(actorName, updatedTrip.name, changedFields);
            await appendCollaborationAlerts({
                trip: updatedTrip,
                actorUserId: userId,
                type: 'trip_updated',
                message,
                metadata: {
                    tripId: String(updatedTrip._id),
                    changedFields,
                },
            });
        }

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

router.patch('/:id/collab-alerts/:alertId/read', async (req, res) => {
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

      const alert = trip.collabAlerts.id(req.params.alertId);
      if (!alert) return res.status(404).json({ error: 'Alert not found' });
      if (userIdString(alert.recipientUserId) !== userIdString(userId)) {
        return res.status(403).json({ error: 'You can only mark your own alerts as read' });
      }

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

        if (cleanData.totalCost !== undefined) {
            const costBefore = Number(route.totalCost) || 0;
            const costAfter = Number(cleanData.totalCost) || 0;
            trip.totalCost = trip.totalCost + (costAfter - costBefore);
        }

        const changedKeys = Object.keys(cleanData).filter((key) => {
            const before = route[key] instanceof Date ? route[key].toISOString() : JSON.stringify(route[key] ?? null);
            const after = cleanData[key] instanceof Date
                ? cleanData[key].toISOString()
                : JSON.stringify(cleanData[key] ?? null);
            return before !== after;
        });

        Object.assign(route, cleanData);
        await trip.save();

        if (changedKeys.length > 0) {
            const actorName = await actorLabel(userId);
            const message = `${actorName} updated route "${route.name}" on ${trip.name}.`;
            await appendCollaborationAlerts({
                trip,
                actorUserId: userId,
                type: 'route_updated',
                message,
                metadata: {
                    tripId: String(trip._id),
                    routeId: String(route._id),
                    changedFields: changedKeys,
                },
            });
        }

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

      const beforePacking = JSON.stringify(trip.packingList || []);
      const afterPacking = JSON.stringify(packingList || []);
      trip.packingList = packingList;
      await trip.save();

      if (beforePacking !== afterPacking) {
        const actorName = await actorLabel(userId);
        const message = `${actorName} updated the packing list on ${trip.name}.`;
        await appendCollaborationAlerts({
          trip,
          actorUserId: userId,
          type: 'trip_updated',
          message,
          metadata: {
            tripId: String(trip._id),
            changedFields: ['packingList'],
          },
        });
      }

      res.json({ packingList: trip.packingList });
    } catch (err) {
      console.error('Error updating packing list:', err);
      res.status(500).json({ error: 'Could not update packing list' });
    }
  });
  
module.exports = router;