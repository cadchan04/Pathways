import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// create a new accommodation
export const createAccommodation = async (tripId, accommodationData, userId) => {
    try {
    const response = await axios.post(`${API_URL}/api/trips/${tripId}/accommodations`, accommodationData, {
        params: { userId },
    });
    return response.data;
    } catch (err) {
        console.error("Error creating accommodation:", err);
        throw err;
    }
};

// get all accommodations for the specified trip
export const getAccommodations = async (tripId, userId) => {
    try {
        const response = await axios.get(`${API_URL}/api/trips/${tripId}/accommodations`, {
            params: { userId },
        });
        return response.data;
    } catch (err) {
        console.error("Error fetching accommodations:", err);
        throw err;
    }
};

// get a specific accommodation given a specified accommodation id
export const getAccommodationById = async (tripId, accId, userId) => {
    try {
        const response = await axios.get(`${API_URL}/api/trips/${tripId}/accommodations/${accId}`, {
            params: { userId: userId }
        });
        return response.data;
    } catch (err) {
        console.error("Error fetching accommodation by ID:", err);
        throw err;
    }
};

// update a specific accommodation
export const updateAccommodation = async (tripId, accId, accData, userId) => {
    try {
        const response = await axios.put(`${API_URL}/api/trips/${tripId}/accommodations/${accId}`, accData, {
            params: { userId: userId }
        });
        return response.data;
    } catch (err) {
        console.error("Error updating accommodation:", err);
        throw err;
    }
};

// delete an accommodation by its ID
export const deleteAccommodation = async (tripId, accId, userId) => {
    try {
        const response = await axios.delete(`${API_URL}/api/trips/${tripId}/accommodations/${accId}`, {
            params: { userId },
        });
        return response.data;
    } catch (err) {
        console.error("Error deleting accommodation:", err);
        throw err;
    }
};