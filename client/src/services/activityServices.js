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

export const getActivityById = async (tripId, activityId) => {
    try {
        const response = await axios.get(`${API_URL}/api/trips/${tripId}/activities/${activityId}`);
        return response.data;
    } catch (err) {
        console.error("Error fetching activity by ID:", err);
        throw err;
    }
};

export const updateActivity = async (tripId, activityId, activityData) => {
    try {
        const response = await axios.put(`${API_URL}/api/trips/${tripId}/activities/${activityId}`, activityData);
        return response.data;
    } catch (err) {
        console.error("Error updating activity:", err);
        throw err;
    }
};

export const deleteActivity = async (tripId, activityId) => {
    try {
        const response = await axios.delete(`${API_URL}/api/trips/${tripId}/activities/${activityId}`);
        return response.data;
    } catch (err) {
        console.error("Error deleting activity:", err);
        throw err;
    }
};
