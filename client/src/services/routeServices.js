import axios from 'axios'

//
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const fetchLocationAutocomplete = async (query) => {
  if (!query || !query.trim()) return []

  const response = await axios.get(`${API_URL}/api/routes/locations/autocomplete`, {
    params: { q: query.trim() }
  })

  return response.data
}

export const fetchRouteSuggestions = async ({ originId, destinationId, departDate}) => {
  const response = await axios.get(`${API_URL}/api/routes/suggestions`, {
    params: {
      originId,
      destinationId,
      departDate
    }
  })

  return response.data
}
