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
  (trip.collaborators || []).forEach((c) => ids.add(mongoIdString(c.userId)));
  (trip.collaboratorIds || []).forEach((id) => ids.add(mongoIdString(id)));
  return ids.size > 0;
}

export function canEditTripAsUser(trip, userId) {
  const role = tripRoleForUser(trip, userId);
  return role === 'owner' || role === 'editor';
}
