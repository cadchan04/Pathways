const User = require('../models/User');
const { collaboratorEntries, userIdString } = require('../collaboration/tripAccess');

function isCollaborativeTrip(trip) {
  return collaboratorEntries(trip).length > 0;
}

function participantIds(trip) {
  const ids = new Set();
  const ownerId = userIdString(trip?.owner);
  if (ownerId) ids.add(ownerId);
  for (const c of collaboratorEntries(trip)) {
    if (c.userId) ids.add(c.userId);
  }
  return [...ids];
}

function listToSentence(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

async function actorLabel(actorUserId) {
  const uid = userIdString(actorUserId);
  if (!uid) return 'A collaborator';
  try {
    const user = await User.findById(uid).select('name email');
    if (user?.name?.trim()) return user.name.trim();
    if (user?.email?.trim()) return user.email.trim();
  } catch (err) {
    console.error('Error resolving actor label for collaboration notification:', err);
  }
  return 'A collaborator';
}

function buildTripUpdateMessage(actorName, tripName, changedFields = []) {
  if (!changedFields.length) {
    return `${actorName} updated ${tripName}.`;
  }
  return `${actorName} updated ${listToSentence(changedFields)} on ${tripName}.`;
}

async function appendCollaborationAlerts({
  trip,
  actorUserId,
  type,
  message,
  metadata = {},
}) {
  const actorId = userIdString(actorUserId);
  if (!trip || !actorId) return 0;
  if (!isCollaborativeTrip(trip)) return 0;

  const recipients = participantIds(trip).filter((id) => id !== actorId);
  if (!recipients.length) return 0;

  const alerts = recipients.map((recipientUserId) => ({
    actorUserId: actorId,
    recipientUserId,
    type,
    message,
    metadata,
  }));

  trip.collabAlerts = trip.collabAlerts || [];
  trip.collabAlerts.push(...alerts);
  await trip.save();
  return alerts.length;
}

module.exports = {
  actorLabel,
  buildTripUpdateMessage,
  appendCollaborationAlerts,
};
