const axios = require('axios')

const MILES_PER_METER = 0.000621371
const MAX_ROUTING_DISTANCE_METERS = 10_000_000

function haversineMeters(a, b) {
  if (!a?.lat || !b?.lat || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return Infinity
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

const round = (value, places = 1) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

const normalizeGeoapifyGeocode = (result, fallbackName) => {
  const lat = Number(result?.lat)
  const lng = Number(result?.lon)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const displayName =
    result.formatted ||
    [result.name, result.city, result.state, result.country].filter(Boolean).join(', ') ||
    fallbackName

  return {
    id: String(result.place_id || displayName || fallbackName),
    name: displayName || fallbackName,
    address: result.formatted || displayName || fallbackName,
    coordinates: { lat, lng }
  }
}

const geocodeLocation = async (name, apiKey) => {
  const response = await axios.get('https://api.geoapify.com/v1/geocode/search', {
    params: {
      text: name,
      format: 'json',
      limit: 1,
      apiKey
    },
    timeout: 12000
  })

  return normalizeGeoapifyGeocode(response.data?.results?.[0], name)
}

const estimateDrivingCostUsd = ({ distanceMiles, durationMinutes }) => {
  const estimate = distanceMiles * 0.18 + durationMinutes * 0.02
  return Math.max(4, round(estimate, 2))
}

const buildDrivingRoute = ({ origin, destination, departDate, distanceMeters, durationSeconds }) => {
  const totalDistance = round(distanceMeters * MILES_PER_METER, 1)
  const totalDuration = Math.max(1, Math.round(durationSeconds / 60))
  const totalCost = estimateDrivingCostUsd({ distanceMiles: totalDistance, durationMinutes: totalDuration })

  const departAtDate = new Date(`${departDate}T09:00:00`)
  if (Number.isNaN(departAtDate.getTime())) {
    return null
  }

  const arriveAtDate = new Date(departAtDate)
  arriveAtDate.setMinutes(arriveAtDate.getMinutes() + totalDuration)

  const departAt = departAtDate.toISOString()
  const arriveAt = arriveAtDate.toISOString()

  return {
    id: `driving_${origin.id}_${destination.id}`.replace(/[^a-zA-Z0-9_:-]/g, '_'),
    isRealData: true,
    name: `${origin.name} to ${destination.name} drive`,
    origin,
    destination,
    departAt,
    arriveAt,
    legs: [
      {
        transportationMode: 'Driving',
        provider: 'Personal Vehicle',
        origin,
        destination,
        departAt,
        arriveAt,
        duration: totalDuration,
        distance: totalDistance,
        cost: totalCost
      }
    ],
    totalCost,
    totalDuration,
    totalDistance
  }
}

const getDrivingRoutes = async ({ originName, destinationName, departDate }) => {
  const apiKey = process.env.GEOAPIFY_API_KEY
  if (!apiKey) return []
  if (!originName || !destinationName || !departDate) return []

  try {
    const [origin, destination] = await Promise.all([
      geocodeLocation(originName, apiKey),
      geocodeLocation(destinationName, apiKey)
    ])

    if (!origin || !destination) return []

    const distMeters = haversineMeters(origin.coordinates, destination.coordinates)
    if (distMeters > MAX_ROUTING_DISTANCE_METERS) return []

    const response = await axios.get('https://api.geoapify.com/v1/routing', {
      params: {
        waypoints: `${origin.coordinates.lat},${origin.coordinates.lng}|${destination.coordinates.lat},${destination.coordinates.lng}`,
        mode: 'drive',
        format: 'json',
        apiKey
      },
      timeout: 12000
    })

    const route = response.data?.results?.[0] || response.data?.features?.[0]?.properties
    const distanceMeters = Number(route?.distance)
    const durationSeconds = Number(route?.time ?? route?.duration)

    if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) return []

    const normalized = buildDrivingRoute({
      origin,
      destination,
      departDate,
      distanceMeters,
      durationSeconds
    })

    return normalized ? [normalized] : []
  } catch (err) {
    console.error('Driving route provider error:', err.response?.data || err.message)
    return []
  }
}

module.exports = { getDrivingRoutes }
