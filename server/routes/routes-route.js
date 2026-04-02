const express = require('express')
const axios = require('axios')
const {
  searchLocations,
  validateSuggestionsQuery,
  //buildRouteSuggestions
} = require('../services/mock-routes-service')
const { searchFlightsCity } = require('../services/flight-services')
const { getTrainRoutes } = require('../services/train-service');
const { getDrivingRoutes } = require('../services/driving-service')
const { getBusRoutes } = require('../services/bus-service');
const { multiModalRoutes, regenerateRoute } = require("../services/multi-modal-service")
const { getEstimatedRideshareRoutes } = require('../services/rideshare-estimate-service')

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

router.get('/suggestions', async (req, res) => {
  const { originId, destinationId, departDate, originName, destinationName, mpg } = req.query

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

  const routes = []

  try {
    const { originId, destinationId, departDate, originName, destinationName, mpg } = req.query

    const mpgNumber = mpg && !isNaN(mpg) ? Number(mpg) : 25
    // get personal driving routes
    const drivingRoutes = await getDrivingRoutes({ originName, destinationName, departDate, mpg: mpgNumber })
    // build estimated rideshare routes from driving metrics
    const rideshareRoutes = getEstimatedRideshareRoutes({ drivingRoutes })
    // get train routes
    const trainRoutes = await getTrainRoutes({ originName, destinationName, departDate });
    // get flight routes
    const flights = await searchFlightsCity(originName, destinationName, departDate);
    // get bus routes
    const busRoutes = await getBusRoutes({ originName, destinationName, departDate });

    /* Return combined list */
    routes.push(...drivingRoutes)
    routes.push(...rideshareRoutes)
    routes.push(...trainRoutes)
    routes.push(...flights)
    routes.push(...busRoutes);
    // return res.json({ routes: [...trainRoutes, ...mockRoutes] }); // alternatively, can also combine and return

  } catch (err) {
    console.error("Integration Error:", err.message)
    return res.status(502).json({
      error: 'Route providers are currently unavailable. Please try again later.',
      routes: []
    })
  }

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

router.post("/multimodal", async (req, res) => {

  try {

    const { origin, destination, date, mpg } = req.body

    const routes = await multiModalRoutes(
      origin,
      destination,
      date,
      mpg
    )

    res.json(routes)

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "Failed to generate routes"
    })

  }

})

router.post("/regenerate", async (req, res) => {
  console.log("Received request to regenerate route with body:", req.body)
  try {

    const { route, legIndicies } = req.body

    const newRoute = await regenerateRoute (
      route,
      legIndicies
    )

    res.json(newRoute)

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "Failed to regenerate route"
    })

  }

})

module.exports = router;
