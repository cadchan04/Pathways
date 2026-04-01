import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function idParam(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object' && value.$oid) return value.$oid;
  return String(value);
}

/**
 * @param {string} tripId
 * @param {string} email
 * @param {string} userId - inviter (must be trip owner)
 */
export const sendTripInvitation = async (tripId, email, userId) => {
  const response = await axios.post(
    `${API_URL}/api/trips/${encodeURIComponent(idParam(tripId))}/invitations`,
    { email: String(email || '').trim() },
    { params: { userId: idParam(userId) } }
  );
  return response.data;
};

// All invitations for a trip (owner only)
export const listTripInvitations = async (tripId, userId) => {
  const response = await axios.get(
    `${API_URL}/api/trips/${encodeURIComponent(idParam(tripId))}/invitations`,
    {
      params: { userId: idParam(userId) },
    }
  );
  return response.data;
};

// Pending invitations for the current user's email
export const listMyInvitations = async (userId) => {
  const response = await axios.get(`${API_URL}/api/invitations`, {
    params: { userId: idParam(userId) },
  });
  return response.data;
};

export const acceptInvitation = async (invitationId, userId) => {
  const response = await axios.post(
    `${API_URL}/api/invitations/${encodeURIComponent(idParam(invitationId))}/accept`,
    {},
    { params: { userId: idParam(userId) } }
  );
  return response.data;
};

export const declineInvitation = async (invitationId, userId) => {
  const response = await axios.post(
    `${API_URL}/api/invitations/${encodeURIComponent(idParam(invitationId))}/decline`,
    {},
    { params: { userId: idParam(userId) } }
  );
  return response.data;
};
