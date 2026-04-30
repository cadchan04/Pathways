const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip.js');
const Activity = require('../models/Activity');
const Accommodation = require('../models/Accommodation');
const User = require('../models/User.js');
const {
    actorNameFromUser,
    addTripHistoryEntry,
    applyTripVersionSnapshot,
    buildTripVersionSnapshot,
    buildTripFieldChanges,
} = require('../services/trip-changelog-service.js');
const {
    userIdString,
    canViewTrip,
    canManageTrip,
    canEditTrip,
    canDuplicateTrip,
    isCollaborator,
    collaboratorEntries,
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

async function duplicateTripChildren(sourceTripId, newTripId, newOwnerId) {
    const [activities, accommodations] = await Promise.all([
        Activity.find({ tripId: sourceTripId }).lean(),
        Accommodation.find({ tripId: sourceTripId }).lean(),
    ]);

    if (activities.length > 0) {
        const activityCopies = activities.map((activity) => {
            const copy = { ...activity };
            delete copy._id;
            delete copy.createdAt;
            delete copy.updatedAt;
            copy.tripId = newTripId;
            copy.owner = newOwnerId;
            return copy;
        });
        await Activity.insertMany(activityCopies);
    }

    if (accommodations.length > 0) {
        const accommodationCopies = accommodations.map((accommodation) => {
            const copy = { ...accommodation };
            delete copy._id;
            delete copy.createdAt;
            delete copy.updatedAt;
            copy.tripId = newTripId;
            copy.owner = newOwnerId;
            return copy;
        });
        await Accommodation.insertMany(accommodationCopies);
    }
}

function isCollaborativeTrip(trip) {
    return collaboratorEntries(trip).length > 0;
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
        await duplicateTripChildren(source._id, saved._id, newOwnerId);
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
        await trip.save();
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

// GET restorable previous versions for a trip (owner or collaborator only)
router.get('/:id/versions', async (req, res) => {
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

        const versions = (trip.editHistory || [])
            .filter((entry) => entry.snapshotBefore)
            .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
            .map((entry) => ({
                _id: entry._id,
                historyId: entry._id,
                summary: entry.summary,
                action: entry.action,
                changedBy: entry.changedBy,
                changedByName: entry.changedByName,
                changedAt: entry.changedAt,
                snapshot: entry.snapshotBefore,
            }));

        res.status(200).json(versions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST restore a trip to a selected previous version (owner or editor only)
router.post('/:id/rollback', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const { historyId, versionId } = req.body || {};
        const selectedId = String(historyId || versionId || '');
        if (!selectedId) {
            return res.status(400).json({ error: 'historyId is required' });
        }

        const trip = await Trip.findById(req.params.id);
        if (!trip) {
            return res.status(404).json({ message: "Trip not found" });
        }

        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to roll back this trip' });
        }

        const versionEntry = (trip.editHistory || []).find((entry) => String(entry._id) === selectedId);
        if (!versionEntry || !versionEntry.snapshotBefore) {
            return res.status(404).json({ error: 'Selected trip version was not found' });
        }

        const snapshotBeforeRollback = buildTripVersionSnapshot(trip);
        applyTripVersionSnapshot(trip, versionEntry.snapshotBefore);
        trip.updatedAt = new Date();

        const actor = await User.findById(userId).catch(() => null);
        addTripHistoryEntry(trip, {
            userId,
            userName: actorNameFromUser(actor, userId),
            action: 'trip_rolled_back',
            summary: `Rolled back trip to version before: ${versionEntry.summary || 'previous change'}`,
            changes: [],
            snapshotBefore: snapshotBeforeRollback,
        });

        const updatedTrip = await trip.save();
        const actorName = await actorLabel(userId);
        await appendCollaborationAlerts({
            trip: updatedTrip,
            actorUserId: userId,
            type: 'trip_updated',
            message: `${actorName} rolled back ${updatedTrip.name} to a previous version.`,
            metadata: {
                tripId: String(updatedTrip._id),
                rollbackHistoryId: selectedId,
                changedFields: ['rollback'],
            },
        });

        res.status(200).json(updatedTrip);
    } catch (err) {
        console.error('Error rolling back trip:', err);
        res.status(500).json({ error: 'Could not roll back trip' });
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
        const changedFields = changes.map((change) => change.field);
        const snapshotBefore = changes.length > 0 ? buildTripVersionSnapshot(trip) : null;

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
                snapshotBefore,
            });
        }

        const updatedTrip = await trip.save();

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

router.post('/:id/itinerary-options', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to add itinerary options on this trip' });
        }
        if (!isCollaborativeTrip(trip)) {
            return res.status(400).json({ error: 'Itinerary options are available only for collaborative trips' });
        }

        const optionPayload = {
            title: req.body?.title,
            summary: req.body?.summary,
            status: req.body?.status,
            items: Array.isArray(req.body?.items) ? req.body.items : [],
            estimatedTotalCost: req.body?.estimatedTotalCost,
            proposedByUserId: userIdString(userId),
        };

        trip.itineraryOptions = trip.itineraryOptions || [];
        trip.itineraryOptions.push(optionPayload);
        await trip.save();

        const createdOption = trip.itineraryOptions[trip.itineraryOptions.length - 1];
        const actorName = await actorLabel(userId);
        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'itinerary_option_added',
            message: `${actorName} proposed itinerary option "${createdOption.title}" on ${trip.name}.`,
            metadata: {
                tripId: String(trip._id),
                itineraryOptionId: String(createdOption._id),
            },
        });

        res.status(201).json(createdOption);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/:id/itinerary-options', async (req, res) => {
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
        if (!isCollaborativeTrip(trip)) {
            return res.status(400).json({ error: 'Itinerary options are available only for collaborative trips' });
        }

        const options = trip.itineraryOptions || [];
        const labelUids = new Set();
        for (const option of options) {
            for (const review of option?.reviews || []) {
                const needs = !String(review?.userLabel || '').trim();
                if (needs && review?.userId) labelUids.add(userIdString(review.userId));
            }
            for (const comment of option?.comments || []) {
                const needs = !String(comment?.userLabel || '').trim();
                if (needs && comment?.userId) labelUids.add(userIdString(comment.userId));
            }
        }
        const labelByUid = {};
        for (const uid of labelUids) {
            labelByUid[uid] = await actorLabel(uid);
        }
        for (const option of options) {
            for (const review of option?.reviews || []) {
                if (String(review?.userLabel || '').trim()) continue;
                if (!review?.userId) continue;
                const uid = userIdString(review.userId);
                review.userLabel = labelByUid[uid] || review.userLabel || '';
            }
            for (const comment of option?.comments || []) {
                if (String(comment?.userLabel || '').trim()) continue;
                if (!comment?.userId) continue;
                const uid = userIdString(comment.userId);
                comment.userLabel = labelByUid[uid] || comment.userLabel || '';
            }
        }

        res.json(options);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/itinerary-options/:optionId', async (req, res) => {
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
        if (!isCollaborativeTrip(trip)) {
            return res.status(400).json({ error: 'Itinerary options are available only for collaborative trips' });
        }

        const option = trip.itineraryOptions?.id(req.params.optionId);
        if (!option) return res.status(404).json({ error: 'Itinerary option not found' });

        const labelUids = new Set();
        for (const review of option?.reviews || []) {
            const needs = !String(review?.userLabel || '').trim();
            if (needs && review?.userId) labelUids.add(userIdString(review.userId));
        }
        for (const comment of option?.comments || []) {
            const needs = !String(comment?.userLabel || '').trim();
            if (needs && comment?.userId) labelUids.add(userIdString(comment.userId));
        }
        const labelByUid = {};
        for (const uid of labelUids) {
            labelByUid[uid] = await actorLabel(uid);
        }
        for (const review of option?.reviews || []) {
            if (String(review?.userLabel || '').trim()) continue;
            if (!review?.userId) continue;
            const uid = userIdString(review.userId);
            review.userLabel = labelByUid[uid] || review.userLabel || '';
        }
        for (const comment of option?.comments || []) {
            if (String(comment?.userLabel || '').trim()) continue;
            if (!comment?.userId) continue;
            const uid = userIdString(comment.userId);
            comment.userLabel = labelByUid[uid] || comment.userLabel || '';
        }

        res.json(option);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/itinerary-options/:optionId', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to update itinerary options on this trip' });
        }
        if (!isCollaborativeTrip(trip)) {
            return res.status(400).json({ error: 'Itinerary options are available only for collaborative trips' });
        }

        const option = trip.itineraryOptions?.id(req.params.optionId);
        if (!option) return res.status(404).json({ error: 'Itinerary option not found' });

        if (req.body?.title !== undefined) option.title = req.body.title;
        if (req.body?.summary !== undefined) option.summary = req.body.summary;
        if (req.body?.status !== undefined) option.status = req.body.status;
        if (req.body?.estimatedTotalCost !== undefined) option.estimatedTotalCost = req.body.estimatedTotalCost;
        if (Array.isArray(req.body?.items)) option.items = req.body.items;

        await trip.save();

        const actorName = await actorLabel(userId);
        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'itinerary_option_updated',
            message: `${actorName} updated itinerary option "${option.title}" on ${trip.name}.`,
            metadata: {
                tripId: String(trip._id),
                itineraryOptionId: String(option._id),
            },
        });

        res.json(option);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/:id/itinerary-options/:optionId/review', async (req, res) => {
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
        if (!isCollaborativeTrip(trip)) {
            return res.status(400).json({ error: 'Itinerary options are available only for collaborative trips' });
        }

        const option = trip.itineraryOptions?.id(req.params.optionId);
        if (!option) return res.status(404).json({ error: 'Itinerary option not found' });

        const allowedVotes = ['preferred', 'acceptable', 'not_preferred'];
        const requestedVote = String(req.body?.value || '').trim();

        const uid = userIdString(userId);
        const actorName = await actorLabel(userId);
        option.reviews = option.reviews || [];
        const existing = option.reviews.find((r) => userIdString(r.userId) === uid);

        let voteValue = requestedVote;
        if (voteValue) {
            if (!allowedVotes.includes(voteValue)) {
                return res.status(400).json({ error: 'Invalid vote value' });
            }
        } else {
            if (existing?.value && allowedVotes.includes(existing.value)) {
                voteValue = existing.value;
            } else {
                voteValue = 'acceptable';
            }
        }

        if (existing) {
            existing.value = voteValue;
            existing.comment = String(req.body?.comment || '').trim();
            existing.userLabel = actorName;
        } else {
            option.reviews.push({
                userId: uid,
                value: voteValue,
                comment: String(req.body?.comment || '').trim(),
                userLabel: actorName,
            });
        }

        await trip.save();

        res.json(option);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/:id/itinerary-options/:optionId/comments', async (req, res) => {
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
        if (!isCollaborativeTrip(trip)) {
            return res.status(400).json({ error: 'Itinerary options are available only for collaborative trips' });
        }

        const option = trip.itineraryOptions?.id(req.params.optionId);
        if (!option) return res.status(404).json({ error: 'Itinerary option not found' });

        const trimmed = String(req.body?.comment || '').trim();
        if (!trimmed) return res.status(400).json({ error: 'comment is required' });

        const actorName = await actorLabel(userId);
        option.comments = option.comments || [];
        option.comments.push({
            userId: userIdString(userId),
            comment: trimmed,
            userLabel: actorName,
        });

        await trip.save();

        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'itinerary_option_commented',
            message: `${actorName} commented on itinerary option "${option.title}" on ${trip.name}.`,
            metadata: {
                tripId: String(trip._id),
                itineraryOptionId: String(option._id),
            },
        });

        res.json(option);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/:id/itinerary-options/:optionId', async (req, res) => {
    try {
        const userId = readUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'userId is required' });
        }

        const trip = await Trip.findById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        if (!canEditTrip(trip, userId)) {
            return res.status(403).json({ error: 'You do not have permission to delete itinerary options on this trip' });
        }
        if (!isCollaborativeTrip(trip)) {
            return res.status(400).json({ error: 'Itinerary options are available only for collaborative trips' });
        }

        const option = trip.itineraryOptions?.id(req.params.optionId);
        if (!option) return res.status(404).json({ error: 'Itinerary option not found' });
        const deletedTitle = option.title;
        const deletedId = String(option._id);
        option.deleteOne();
        await trip.save();

        const actorName = await actorLabel(userId);
        await appendCollaborationAlerts({
            trip,
            actorUserId: userId,
            type: 'itinerary_option_deleted',
            message: `${actorName} removed itinerary option "${deletedTitle}" from ${trip.name}.`,
            metadata: {
                tripId: String(trip._id),
                itineraryOptionId: deletedId,
            },
        });

        res.json({ message: 'Itinerary option deleted successfully' });
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

        const actor = await User.findById(userId).catch(() => null);
        const routeName = route.name || cleanData.name || 'route';
        const snapshotBefore = buildTripVersionSnapshot(trip);

        Object.assign(route, cleanData);
        addTripHistoryEntry(trip, {
            userId,
            userName: actorNameFromUser(actor, userId),
            action: 'route_updated',
            summary: `Updated route: ${routeName}`,
            changes: [],
            snapshotBefore,
        });

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
        } else {
            await trip.save();
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
