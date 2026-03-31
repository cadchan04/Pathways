const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip.js');

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

// GET route to fetch all trips for a user
router.get('/', async (req, res) => {
    const { userId } = req.query;

    try {
        const trips = await Trip.find({ owner: userId });

        res.status(200).json(trips);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

// POST duplicate trip
router.post('/:id/duplicate', async (req, res) => {
    try {
        const source = await Trip.findById(req.params.id);
        if (!source) {
            return res.status(404).json({ message: 'Trip not found' });
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

// GET a single trip by its ID
router.get('/:id', async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id);

        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        res.status(200).json(trip);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

// Delete a trip by ID
router.delete('/:id', async(req, res) => {
    try {
        const deletedTrip = await Trip.findByIdAndDelete(req.params.id);

        if (!deletedTrip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        res.status(200).json({ message: "Trip deleted successfully" });
    } catch (err) {
        console.error("Error deleting trip: ", err);
        res.status(500).json({ error: "Failed to delete trip" });
    }
});

// Edit a trip by ID
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedTrip = await Trip.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedTrip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        res.status(200).json(updatedTrip);
        
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.patch('/:id/alerts/:alertId/read', async (req, res) => {
    try {
      const trip = await Trip.findById(req.params.id);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
  
      const alert = trip.priceAlerts.id(req.params.alertId); // ✅ find by _id
      if (!alert) return res.status(404).json({ error: 'Alert not found' });
  
      alert.read = true;
      await trip.save();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

module.exports = router;