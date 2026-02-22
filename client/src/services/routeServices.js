import axios from 'axios'

//
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getLocationAutocomplete = async (query) => {
  if (!query || !query.trim()) return []

  const response = await axios.get(`${API_URL}/api/routes/locations/autocomplete`, {
    params: { q: query.trim() }
  })

  return response.data
}

export const getRouteSuggestions = async ({ originId, destinationId, departDate}) => {
  const response = await axios.get(`${API_URL}/api/routes/suggestions`, {
    params: {
      originId,
      destinationId,
      departDate
    }
  })

  return response.data
}

export const testApiCall = () => {
    return axios.get(`${API_URL}/api-test`)
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const addRoute = async (tripId, routeData) => {
    console.log("Adding route with data:", routeData)
    return await axios.post(`${API_URL}/api/trips/${tripId}/routes/`, routeData)
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const getRoutes = async (tripId) => {
    return await axios.get(`${API_URL}/api/trips/${tripId}/routes/`)
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const getLegs = async (tripId, routeId) => {
    return await axios.get(`${API_URL}/api/trips/${tripId}/routes/${routeId}/legs/`)
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const updateLeg = async (tripId, routeId, legId, legData) => {
    return await axios.patch(`${API_URL}/api/trips/${tripId}/routes/${routeId}/legs/${legId}`, legData)
        .then(res => res.data)
        .catch(err => console.error(err))
}