import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getTrainOptions = async (params) => {
    try {
        const response = await axios.post(`${API_URL}/api/trains/search-trains`, params);
        
        const routes = response.data.routes || [];
        return routes.sort((a, b) => {
            const durationA = parseInt(a.duration.replace('s', ''));
            const durationB = parseInt(b.duration.replace('s', ''));
            return durationA - durationB;
        });
    } catch (err) {
        console.error("Error in getTrainOptions:", err);
        throw err;
    }
}