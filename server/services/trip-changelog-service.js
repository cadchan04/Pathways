const TRIP_EDIT_FIELDS = [
  { key: 'name', label: 'Trip name', type: 'text' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'startDate', label: 'Start date', type: 'date' },
  { key: 'endDate', label: 'End date', type: 'date' },
  { key: 'budget', label: 'Budget', type: 'money' },
];

function normalizeDate(value) {
  if (!value) return '';
  const date = new Date(value?.$date || value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function normalizeValue(value, type) {
  if (value == null) return '';
  if (type === 'date') return normalizeDate(value);
  if (type === 'money') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '';
  }
  return String(value);
}

function formatValue(value, type) {
  const normalized = normalizeValue(value, type);
  if (!normalized) return 'blank';
  if (type === 'money') return `$${normalized}`;
  return normalized;
}

function buildTripFieldChanges(beforeTrip, updatePayload) {
  return TRIP_EDIT_FIELDS
    .filter(({ key }) => Object.prototype.hasOwnProperty.call(updatePayload, key))
    .map(({ key, label, type }) => {
      const previousValue = beforeTrip?.[key];
      const nextValue = updatePayload[key];
      const previous = normalizeValue(previousValue, type);
      const next = normalizeValue(nextValue, type);

      if (previous === next) return null;

      return {
        field: key,
        label,
        previousValue: formatValue(previousValue, type),
        newValue: formatValue(nextValue, type),
      };
    })
    .filter(Boolean);
}

function actorNameFromUser(user, fallbackUserId) {
  return user?.name || user?.email || String(fallbackUserId || 'Unknown user');
}

function addTripHistoryEntry(trip, { userId, userName, action, summary, changes = [] }) {
  if (!trip) return;
  if (!Array.isArray(trip.editHistory)) {
    trip.editHistory = [];
  }

  trip.editHistory.push({
    action,
    summary,
    changedBy: userId ? String(userId) : '',
    changedByName: userName || String(userId || 'Unknown user'),
    changedAt: new Date(),
    changes,
  });
}

module.exports = {
  actorNameFromUser,
  addTripHistoryEntry,
  buildTripFieldChanges,
  formatValue,
  normalizeValue,
};
