import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getAccommodationActivityPreferences = async (tripId, userId) => {
  const response = await axios.get(
    `${API_URL}/api/trips/${tripId}/accommodation-activity-preferences`,
    { params: { userId } }
  )
  return response.data
}

export const saveMyAccommodationActivityPreferences = async (
  tripId,
  accommodationRankByCategory,
  activityRankByCategory,
  userId
) => {
  const response = await axios.put(
    `${API_URL}/api/trips/${tripId}/accommodation-activity-preferences/me`,
    { accommodationRankByCategory, activityRankByCategory },
    { params: { userId } }
  )
  return response.data
}
