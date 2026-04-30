const express = require('express');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { checkAndSendPriceChangeNotifications } = require('../services/notifications-service');
const { canViewTrip, canEditTrip, readUserId } = require('../collaboration/tripAccess');
const {
    actorNameFromUser,
    addTripHistoryEntry,
    buildTripVersionSnapshot,
} = require('../services/trip-changelog-service');
const {
    actorLabel,
    appendCollaborationAlerts,
} = require('../services/collaboration-notifications-service');

const router = express.Router({ mergeParams: true });

// Add a new route to a trip
router.post('/', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to add routes to this trip' });
        }

        const costBefore = Number(trip.totalCost) || 0;
        const snapshotBefore = buildTripVersionSnapshot(trip);
        const routeToAdd = {
            name: req.body.name,
            origin: req.body.origin,
            destination: req.body.destination,
            departAt: req.body.departAt,
            arriveAt: req.body.arriveAt,
            legs: req.body.legs,
            totalCost: req.body.totalCost,
            totalDuration: req.body.totalDuration,
            totalDistance: req.body.totalDistance
        };

        trip.routes.push(routeToAdd);

        trip.lastKnownCost = costBefore;
        trip.totalCost = trip.totalCost + (Number(req.body.totalCost) || 0);
        const actor = await User.findById(userId).catch(() => null);
        addTripHistoryEntry(trip, {
            userId,
            userName: actorNameFromUser(actor, userId),
            action: 'route_added',
            summary: `Added route: ${routeToAdd.name || 'Untitled route'}`,
            changes: [],
            snapshotBefore,
        });
        await trip.save();
        const newRoute = trip.routes[trip.routes.length - 1];
        const actorName = await actorLabel(userId);
        const message = `${actorName} added route "${newRoute?.name || req.body.name}" to ${trip.name}.`;
        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'route_added',
            message,
            metadata: {
                tripId: String(trip._id),
                routeId: newRoute ? String(newRoute._id) : undefined,
                routeName: newRoute?.name || req.body.name || null,
            },
        });
        console.log("Updated Trip with new route:", trip.name, req.body.name)
        res.status(201).json(trip);
        checkAndSendPriceChangeNotifications().catch(console.error);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all routes for a trip
router.get('/', async (req, res) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'userId is required' });
    }

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    if (!canViewTrip(trip, userId)) {
      return res.status(403).json({ error: 'You do not have access to this trip' });
    }
    res.json(trip.routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:routeId', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.tripId);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to delete routes on this trip' });
        }
        const route = trip.routes.id(req.params.routeId);
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }

        const costBefore = Number(trip.totalCost) || 0;
        const snapshotBefore = buildTripVersionSnapshot(trip);
        const deletedRouteName = route.name;
        const deletedRouteId = String(route._id);
        const routeName = route.name || 'Untitled route';
        route.deleteOne();

        //trip.totalCost = trip.routes.reduce((sum, r) => sum + (Number(r.totalCost) || 0), 0);
        trip.totalCost = costBefore - (Number(route.totalCost) || 0);
        trip.lastKnownCost = costBefore;
        const actor = await User.findById(userId).catch(() => null);
        addTripHistoryEntry(trip, {
            userId,
            userName: actorNameFromUser(actor, userId),
            action: 'route_deleted',
            summary: `Deleted route: ${routeName}`,
            changes: [],
            snapshotBefore,
        });
        await trip.save();
        const actorName = await actorLabel(userId);
        const message = `${actorName} deleted route "${deletedRouteName}" from ${trip.name}.`;
        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'route_deleted',
            message,
            metadata: {
                tripId: String(trip._id),
                routeId: deletedRouteId,
                routeName: deletedRouteName,
            },
        });
        console.log("Deleted route:", route.name, "from trip:", trip.name)
        res.json({ message: 'Route deleted successfully' });
        checkAndSendPriceChangeNotifications().catch(console.error);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
