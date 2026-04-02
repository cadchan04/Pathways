import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getRoutePreferences = async (tripId, userId) => {
  const response = await axios.get(`${API_URL}/api/trips/${tripId}/route-preferences`, {
    params: { userId },
  })
  return response.data
}

export const saveMyRoutePreference = async (tripId, rankByMode, userId) => {
  const response = await axios.put(
    `${API_URL}/api/trips/${tripId}/route-preferences/me`,
    { rankByMode },
    { params: { userId } }
  )
  return response.data
}

