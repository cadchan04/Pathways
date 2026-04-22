import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// create a new accommodation
export const createAccommodation = async (tripId, accommodationData) => {
    try {
    const response = await axios.post(`${API_URL}/api/trips/${tripId}/accommodations`, accommodationData);
    return response.data;
    } catch (err) {
        console.error("Error creating accommodation:", err);
        throw err;
    }
};

// get all accommodations for the specified trip
export const getAccommodations = async (tripId) => {
    try {
        const response = await axios.get(`${API_URL}/api/trips/${tripId}/accommodations`);
        return response.data;
    } catch (err) {
        console.error("Error fetching accommodations:", err);
        throw err;
    }
};

// delete an accommodation by its ID
export const deleteAccommodation = async (tripId, accId) => {
    try {
        const response = await axios.delete(`${API_URL}/api/trips/${tripId}/accommodations/${accId}`);
        return response.data;
    } catch (err) {
        console.error("Error deleting accommodation:", err);
        throw err;
    }
}