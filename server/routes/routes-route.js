const express = require('express')
const axios = require('axios')
const {
  searchLocations,
  validateSuggestionsQuery,
  buildRouteSuggestions
} = require('../services/mock-routes-service')

const router = express.Router()

const normalizeGeoapifyResult = (result) => {
  const lat = Number(result.lat)
  const lng = Number(result.lon)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const displayName =
    result.formatted ||
    [result.address_line1, result.address_line2].filter(Boolean).join(', ') ||
    [result.name, result.city, result.state, result.country].filter(Boolean).join(', ')

  if (!displayName) return null

  return {
    id: String(result.place_id || result.rank?.place_id || displayName),
    name: displayName,
    address: result.formatted || displayName,
    coordinates: { lat, lng }
  }
}

router.get('/locations/search', async (req, res) => {
  const query = (req.query.q || '').trim()

  if (query.length < 2) {
    return res.json([])
  }

  const apiKey = process.env.GEOAPIFY_API_KEY

  if (!apiKey) {
    return res.json(searchLocations(query))
  }

  try {
    const response = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
      params: {
        text: query,
        format: 'json',
        limit: 8,
        apiKey
      },
      timeout: 5000
    })

    const suggestions = (response.data?.results || [])
      .map(normalizeGeoapifyResult)
      .filter(Boolean)

    return res.json(suggestions)
  } catch (err) {
    console.error('Geoapify autocomplete error:', err.response?.data || err.message)
    return res.json(searchLocations(query))
  }
})

router.get('/suggestions', (req, res) => {
  const { originId, destinationId, departDate, originName, destinationName } = req.query

  const validationError = validateSuggestionsQuery({
    originId,
    destinationId,
    departDate,
    originName,
    destinationName
  })

  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  const routes = buildRouteSuggestions({
    originId,
    destinationId,
    departDate,
    originName,
    destinationName
  })

  return res.json({
    search: {
      originId,
      destinationId,
      departDate,
      originName,
      destinationName
    },
    routes
  })
})

module.exports = router
