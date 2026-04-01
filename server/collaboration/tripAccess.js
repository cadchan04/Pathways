function userIdString(userId) {
  if (userId == null || userId === "") return null;
  if (typeof userId === "object" && userId.$oid) return userId.$oid;
  return String(userId);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function canViewTrip(trip, userId) {
  const uid = userIdString(userId);
  if (!trip || !uid) return false;
  if (userIdString(trip.owner) === uid) return true;
  const ids = trip.collaboratorIds || [];
  return ids.some((id) => userIdString(id) === uid);
}

function canManageTrip(trip, userId) {
  return userIdString(trip.owner) === userIdString(userId);
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
  canViewTrip,
  canManageTrip,
  readUserId,
};
