// Helper functions for trip collaboration based on the server rules

export function mongoIdString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  return String(value);
}

export function tripRoleForUser(trip, userId) {
  const uid = mongoIdString(userId);
  if (!trip || !uid) return null;
  if (mongoIdString(trip.owner) === uid) return 'owner';
  const rows = trip.collaborators || [];
  const row = rows.find((c) => mongoIdString(c.userId) === uid);
  if (row) return row.role === 'viewer' ? 'viewer' : 'editor';
  const legacy = trip.collaboratorIds || [];
  if (legacy.some((id) => mongoIdString(id) === uid)) return 'editor';
  return null;
}

export function hasCollaboratorsOnTrip(trip) {
  if (!trip) return false;
  const ids = new Set();
  const ownerId = mongoIdString(trip.owner);
  (trip.collaborators || []).forEach((c) => {
    const uid = mongoIdString(c.userId);
    if (!uid || uid === ownerId) return;
    ids.add(uid);
  });
  (trip.collaboratorIds || []).forEach((id) => {
    const uid = mongoIdString(id);
    if (!uid || uid === ownerId) return;
    ids.add(uid);
  });
  return ids.size > 0;
}

export function canEditTripAsUser(trip, userId) {
  const role = tripRoleForUser(trip, userId);
  return role === 'owner' || role === 'editor';
}
