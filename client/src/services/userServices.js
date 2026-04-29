import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const syncUser = async (userData) => {
    try {
        const response = await axios.post(`${API_URL}/api/user/sync`, userData);
        return response.data;
    } catch (err) {
        console.error("Status:", err.response?.status)
        throw err;
    }
}

export const getUserById = async (userId) => {
    try {
        const response = await axios.get(`${API_URL}/api/user/get/${userId}`);
        return response.data;
    } catch (err) {
        console.error("Status:", err.response?.status)
        throw err;
    }
}