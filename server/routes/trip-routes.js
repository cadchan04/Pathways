const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip.js');
const { userIdString, canViewTrip, canManageTrip, readUserId } = require('../collaboration/tripAccess');

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
            $or: [{ owner: uid }, { collaboratorIds: uid }],
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

        if (!canManageTrip(source, userId)) {
            return res.status(403).json({ error: 'Only the trip owner can duplicate this trip' });
        }

        const baseName = getTripNameBase(source.name);
        const count = await countTripsInNameFamily(source.owner, baseName);
        const newName = `${baseName} (${count + 1})`;

        const now = new Date();
        const duplicated = new Trip({
            owner: source.owner,
            name: newName,
            description: source.description,
            startDate: source.startDate,
            endDate: source.endDate,
            collaboratorIds: source.collaboratorIds ? [...source.collaboratorIds] : [],
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

// Edit a trip by id (owner only)
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
        if (!canManageTrip(trip, userId)) {
            return res.status(403).json({ error: 'Only the trip owner can edit trip details' });
        }

        const updatedTrip = await Trip.findByIdAndUpdate(
            id,
            req.body,
            { returnDocument: "after", runValidators: true }
        );

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

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        const route = trip.routes.id(routeId);
        if (!route) {
            return res.status(404).json({ message: "Route not found" });
        }

        Object.assign(route, cleanData);
        await trip.save();

        res.status(200).json(route);
    } catch (err) {
        console.error("Error updating route:", err);
        res.status(400).json({ error: "Failed to update route" });
    }
});

router.patch('/:tripId/packing-list', async (req, res) => {
    try {
      const { tripId } = req.params
      const { packingList } = req.body
  
      const trip = await Trip.findByIdAndUpdate(
        tripId,
        { $set: { packingList } },
        { new: true }
      )
  
      if (!trip) return res.status(404).json({ error: 'Trip not found' })
  
      res.json({ packingList: trip.packingList })
    } catch (err) {
      console.error('Error updating packing list:', err)
      res.status(500).json({ error: 'Could not update packing list' })
    }
  });
  
module.exports = router;