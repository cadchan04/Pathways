import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const syncUser = async (userData) => {
    try {
        const response = await axios.post(`${API_URL}/api/user/sync`, userData);
        return response.data;
    } catch (err) {
        console.error("Error syncing user:", err);
        throw err;
    }
}