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

// get all trips for the user
export const getTrips = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/trips`);
        return response.data;
    } catch (err) {
        console.error("Error fetching trips:", err);
        throw err;
    }
};

// get a single trip by ID
export const getTripById = async (id) => {
    try {
        const response = await axios.get(`${API_URL}/api/trips/${id}`);
        return response.data;
    } catch (err) {
        console.error(`Error fetching trip ${id}:`, err);
        throw err;
    }
};