import axios from 'axios'

const API_URL = 'http://localhost:8080'

export const testApiCall = () => {
    return axios.get(`${API_URL}/api-test`)
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const addRoute = async (tripId, routeData) => {
    return await axios.post(`${API_URL}/api/trips/${tripId}/routes/`, routeData)
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const getRoutes = async (tripId) => {
    return await axios.get(`${API_URL}/api/trips/${tripId}/routes/`)
        .then(res => res.data)
        .catch(err => console.error(err))
}