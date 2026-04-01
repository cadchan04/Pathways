import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// create a new trip
export const createTrip = async (tripData) => {
    try {
        const response = await axios.post(`${API_URL}/api/trips`, tripData);
        return response.data;
    } catch (err) {
        console.error("Error creating trip:", err);
        throw err;
    }
};

// get all trips for the specific user
export const getTrips = async (userId) => {
    try {
        const response = await axios.get(`${API_URL}/api/trips`, {
            params: { userId }
        });
        return response.data;
    } catch (err) {
        console.error("Error fetching trips:", err);
        throw err;
    }
};

// get a single trip by ID (userId required)
export const getTripById = async (id, userId) => {
    try {
        const response = await axios.get(`${API_URL}/api/trips/${id}`, {
            params: { userId },
        });
        return response.data;
    } catch (err) {
        console.error(`Error fetching trip ${id}:`, err);
        throw err;
    }
};

// duplicate an existing trip (owner only)
export const duplicateTrip = async (tripId, userId) => {
    try {
        const response = await axios.post(`${API_URL}/api/trips/${tripId}/duplicate`, {}, {
            params: { userId },
        });
        return response.data;
    } catch (err) {
        console.error(`Error duplicating trip ${tripId}:`, err);
        throw err;
    }
};

// update a single trip by ID (owner only on server)
export const updateTrip = async (id, tripData, userId) => {
    try {
        const response = await axios.put(`${API_URL}/api/trips/${id}`, tripData, {
            params: { userId },
        });
        return response.data;
    } catch (err) {
        console.error(`Error updating trip ${id}:`, err);
        throw err;
    }
};

export const deleteTripById = async (tripId, userId) => {
    try {
        const response = await axios.delete(`${API_URL}/api/trips/${tripId}`, {
            params: { userId },
        });
        return response.data;
    } catch (err) {
        console.error(`Error deleting trip ${tripId}:`, err);
        throw err;
    }
};