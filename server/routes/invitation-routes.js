const express = require("express");
const mongoose = require("mongoose");
const Trip = require("../models/Trip");
const TripInvitation = require("../models/TripInvitation");
const User = require("../models/User");
const {
  userIdString,
  normalizeEmail,
  canManageTrip,
  canViewTrip,
  readUserId,
} = require("../collaboration/tripAccess");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findUserByEmailNormalized(email) {
  const n = normalizeEmail(email);
  if (!n) return null;
  return User.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(n)}$`, "i") },
  });
}

// GET /api/trips/:tripId/invitations
// list all invitations (owner only)
// POST /api/trips/:tripId/invitations
// body: { email }
// query: userId (owner)
const tripInvitationsRouter = express.Router({ mergeParams: true });

async function getTripInvitationsList(req, res) {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "userId is required" });
    }

    const tripIdParam = req.params.tripId;
    if (!tripIdParam) {
      return res.status(400).json({ error: "Missing trip id" });
    }

    const trip = await Trip.findById(tripIdParam);
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    if (!canManageTrip(trip, userId)) {
      return res.status(403).json({
        error: "Only the trip owner can view invitations for this trip",
      });
    }

    const list = await TripInvitation.find({ tripId: trip._id })
      .sort({ updatedAt: -1 })
      .lean();

    res.json(list);
  } catch (err) {
    console.error("Error listing trip invitations:", err);
    res.status(500).json({ error: "Failed to list invitations" });
  }
}

tripInvitationsRouter.get("/", getTripInvitationsList);
tripInvitationsRouter.get("", getTripInvitationsList);

tripInvitationsRouter.post("/", async (req, res) => {
  try {
    const inviterId = readUserId(req);
    if (!inviterId) {
      return res.status(401).json({ error: "userId is required" });
    }

    const emailRaw = req.body?.email;
    const inviteeEmail = normalizeEmail(emailRaw);
    if (!inviteeEmail || !inviteeEmail.includes("@")) {
      return res.status(400).json({ error: "A valid email is required" });
    }

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    if (!canManageTrip(trip, inviterId)) {
      return res.status(403).json({ error: "Only the trip owner can send invitations" });
    }

    const inviter = await User.findById(inviterId);
    if (inviter && normalizeEmail(inviter.email) === inviteeEmail) {
      return res.status(400).json({ error: "You cannot invite yourself" });
    }

    const inviteeUser = await findUserByEmailNormalized(inviteeEmail);
    const inviteeUserIdStr = inviteeUser ? userIdString(inviteeUser._id) : null;

    if (inviteeUserIdStr && canManageTrip(trip, inviteeUserIdStr)) {
      return res.status(400).json({ error: "That user already owns this trip" });
    }

    if (
      inviteeUserIdStr &&
      (trip.collaboratorIds || []).some((id) => userIdString(id) === inviteeUserIdStr)
    ) {
      return res.status(400).json({ error: "That user is already a collaborator" });
    }

    const existingPending = await TripInvitation.findOne({
      tripId: trip._id,
      inviteeEmail,
      status: "pending",
    });
    if (existingPending) {
      return res.status(409).json({ error: "An invitation is already pending for this email" });
    }

    const invitation = await TripInvitation.create({
      tripId: trip._id,
      inviterId,
      inviteeEmail,
      inviteeUserId: inviteeUserIdStr || undefined,
    });

    res.status(201).json(invitation);
  } catch (err) {
    console.error("Error creating invitation:", err);
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// GET /api/invitations?userId
// pending invites for that user's email
const invitationsRouter = express.Router();

invitationsRouter.get("/", async (req, res) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "userId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const user = await User.findById(userId);
    if (!user || !normalizeEmail(user.email)) {
      return res.status(200).json([]);
    }

    const email = normalizeEmail(user.email);
    const invitations = await TripInvitation.find({
      inviteeEmail: email,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .populate("tripId", "name description startDate endDate owner");

    res.json(invitations);
  } catch (err) {
    console.error("Error listing invitations:", err);
    res.status(500).json({ error: "Failed to list invitations" });
  }
});

invitationsRouter.post("/:invitationId/accept", async (req, res) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "userId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const user = await User.findById(userId);
    if (!user || !normalizeEmail(user.email)) {
      return res.status(403).json({ error: "Your account has no email on file" });
    }

    const invitation = await TripInvitation.findById(req.params.invitationId);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ error: "This invitation is no longer pending" });
    }

    if (normalizeEmail(user.email) !== invitation.inviteeEmail) {
      return res.status(403).json({ error: "This invitation was sent to a different email" });
    }

    const trip = await Trip.findById(invitation.tripId);
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    const uid = userIdString(user._id);
    await Trip.findByIdAndUpdate(trip._id, {
      $addToSet: { collaboratorIds: uid },
    });
    invitation.status = "accepted";
    invitation.inviteeUserId = uid;
    await invitation.save();

    res.json({ message: "Invitation accepted", tripId: trip._id, invitation });
  } catch (err) {
    console.error("Error accepting invitation:", err);
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

invitationsRouter.post("/:invitationId/decline", async (req, res) => {
  try {
    const userId = readUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user || !normalizeEmail(user.email)) {
      return res.status(403).json({ error: "Your account has no email on file" });
    }

    const invitation = await TripInvitation.findById(req.params.invitationId);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (normalizeEmail(user.email) !== invitation.inviteeEmail) {
      return res.status(403).json({ error: "This invitation was sent to a different email" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ error: "This invitation is no longer pending" });
    }

    invitation.status = "declined";
    await invitation.save();

    res.json({ message: "Invitation declined", invitation });
  } catch (err) {
    console.error("Error declining invitation:", err);
    res.status(500).json({ error: "Failed to decline invitation" });
  }
});

module.exports = { tripInvitationsRouter, invitationsRouter };
