import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// create a new activity
export const createActivity = async (tripId, activityData) => {
    try {
        const response = await axios.post(`${API_URL}/api/trips/${tripId}/activities`, activityData);
        return response.data;
    } catch (err) {
        console.error("Error creating activity:", err);
        throw err;
    }
};

// get all activities for the specified trip
export const getActivities = async (tripId) => {
    try {
        const response = await axios.get(`${API_URL}/api/trips/${tripId}/activities`);
        return response.data;
    } catch (err) {
        console.error("Error fetching activities:", err);
        throw err;
    }
};