function userIdString(userId) {
  if (userId == null || userId === "") return null;
  if (typeof userId === "object" && userId.$oid) return userId.$oid;
  return String(userId);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function collaboratorEntries(trip) {
  if (!trip) return [];
  const entries = [];
  const seen = new Set();

  for (const c of trip.collaborators || []) {
    const id = userIdString(c.userId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const role = c.role === "viewer" ? "viewer" : "editor";
    entries.push({ userId: id, role });
  }

  for (const raw of trip.collaboratorIds || []) {
    const id = userIdString(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    entries.push({ userId: id, role: "editor" });
  }

  return entries;
}

function isCollaborator(trip, userId) {
  const uid = userIdString(userId);
  if (!trip || !uid) return false;
  return collaboratorEntries(trip).some((e) => e.userId === uid);
}

function getCollaboratorRole(trip, userId) {
  const uid = userIdString(userId);
  if (!trip || !uid) return null;
  const entry = collaboratorEntries(trip).find((e) => e.userId === uid);
  return entry ? entry.role : null;
}

function canViewTrip(trip, userId) {
  const uid = userIdString(userId);
  if (!trip || !uid) return false;
  if (userIdString(trip.owner) === uid) return true;
  return isCollaborator(trip, userId);
}

function canManageTrip(trip, userId) {
  return userIdString(trip?.owner) === userIdString(userId);
}

function canEditTrip(trip, userId) {
  if (!trip || !userIdString(userId)) return false;
  if (canManageTrip(trip, userId)) return true;
  return getCollaboratorRole(trip, userId) === "editor";
}

function canDuplicateTrip(trip, userId) {
  if (!trip || !userIdString(userId)) return false;
  if (canManageTrip(trip, userId)) return true;
  return isCollaborator(trip, userId);
}

function readUserId(req) {
  if (req.query.userId) return userIdString(req.query.userId);
  if (req.body && req.body.userId) return userIdString(req.body.userId);
  if (req.headers["x-user-id"]) return userIdString(req.headers["x-user-id"]);
  return null;
}

module.exports = {
  userIdString,
  normalizeEmail,
  collaboratorEntries,
  isCollaborator,
  getCollaboratorRole,
  canViewTrip,
  canManageTrip,
  canEditTrip,
  canDuplicateTrip,
  readUserId,
};
