import axios from 'axios'

//
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getSearchLocations = async (query) => {
  if (!query || !query.trim()) return []

  const response = await axios.get(`${API_URL}/api/routes/locations/search`, {
    params: { q: query.trim() }
  })

  return response.data
}

export const getRouteSuggestions = async ({ originId, originName, destinationId, destinationName, departDate, mpg }) => {
  const response = await axios.get(`${API_URL}/api/routes/suggestions`, {
    params: {
      originId,
      originName,
      destinationId,
      destinationName,
      departDate,
      mpg,
    }
  })

  return response.data
}

export const testApiCall = () => {
  return axios.get(`${API_URL}/api-test`)
    .then(res => res.data)
    .catch(err => console.error(err))
}

export const addRoute = async (tripId, routeData, userId) => {
  const response = await axios.post(`${API_URL}/api/trips/${tripId}/routes/`, {
    ...routeData,
    userId,
  })
  return response.data
}

export const getRoutes = async (tripId, userId) => {
  return await axios.get(`${API_URL}/api/trips/${tripId}/routes/`, { params: { userId } })
    .then(res => res.data)
    .catch(err => console.error(err))
}

// delete a route from a trip (owner only)
export const deleteRoute = async (tripId, routeId, userId) => {
    return await axios.delete(`${API_URL}/api/trips/${tripId}/routes/${routeId}/`, {
      params: { userId },
    })
        .then(res => res.data)
        .catch(err => console.error(err))
}

export const getLegs = async (tripId, routeId, userId) => {
  return await axios.get(`${API_URL}/api/trips/${tripId}/routes/${routeId}/legs/`, {
    params: { userId },
  })
    .then(res => res.data)
    .catch(err => console.error(err))
}

export const updateLeg = async (tripId, routeId, legId, legData, userId) => {
  return await axios.patch(
    `${API_URL}/api/trips/${tripId}/routes/${routeId}/legs/${legId}`,
    legData,
    { params: { userId } }
  )
    .then(res => res.data)
    .catch(err => console.error(err))
}

export const getMultiModalRoutes = async ({ origin, destination, date, mpg }) => {
  try {

    const response = await axios.post(`${API_URL}/api/routes/multimodal`, {
      origin,
      destination,
      date,
      mpg
    })

    return response.data

  } catch (err) {
    console.error("Error fetching multimodal routes:", err)
    return []
  }
}

export const regenerateRoute = async (route, legIndicies) => {
    try {
        const response = await axios.post(`${API_URL}/api/routes/regenerate`, { route, legIndicies })
        return response.data
    } catch (err) {
        console.error("Error regenerating route:", err)
        throw err
    }
}
