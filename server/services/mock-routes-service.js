const locations = [
  { id: 'loc_sfo', name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
  { id: 'loc_sjc', name: 'San Jose, CA', lat: 37.3382, lng: -121.8863 },
  { id: 'loc_lax', name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
  { id: 'loc_san', name: 'San Diego, CA', lat: 32.7157, lng: -117.1611 },
  { id: 'loc_sea', name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
  { id: 'loc_pdx', name: 'Portland, OR', lat: 45.5152, lng: -122.6784 },
  { id: 'loc_den', name: 'Denver, CO', lat: 39.7392, lng: -104.9903 },
  { id: 'loc_ord', name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
  { id: 'loc_dfw', name: 'Dallas, TX', lat: 32.7767, lng: -96.797 },
  { id: 'loc_jfk', name: 'New York, NY', lat: 40.7128, lng: -74.006 },
  { id: 'loc_bos', name: 'Boston, MA', lat: 42.3601, lng: -71.0589 },
  { id: 'loc_mia', name: 'Miami, FL', lat: 25.7617, lng: -80.1918 }
]

const routeTemplates = [
  { mode: 'Flight', provider: 'MockAir', baseDuration: 110, baseCost: 165, stops: 0 },
  { mode: 'Train', provider: 'InterState Rail', baseDuration: 300, baseCost: 95, stops: 1 },
  { mode: 'Bus', provider: 'GoBus', baseDuration: 420, baseCost: 65, stops: 1 },
  { mode: 'Rideshare', provider: 'DriveNow', baseDuration: 360, baseCost: 130, stops: 0 }
]

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const normalize = (value) => value.trim().toLowerCase()

const getTodayDateString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isValidDateString = (value) => DATE_REGEX.test(value)

const isPastDate = (value, today = getTodayDateString()) => value < today

const deterministicSeed = (...parts) => {
  const source = parts.join('|')
  let hash = 0

  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i)
    hash |= 0
  }

  return Math.abs(hash)
}

const autocompleteLocations = (query, limit = 8) => {
  if (!query || !query.trim()) return []

  const normalizedQuery = normalize(query)

  return locations
    .filter((location) => normalize(location.name).includes(normalizedQuery))
    .slice(0, limit)
}

const validateSuggestionsQuery = ({ originId, destinationId, departDate }) => {
  if (!originId || !destinationId || !departDate) {
    return 'originId, destinationId, and departDate are required.'
  }

  if (!locations.some((location) => location.id === originId)) {
    return 'Unknown originId.'
  }

  if (!locations.some((location) => location.id === destinationId)) {
    return 'Unknown destinationId.'
  }

  if (originId === destinationId) {
    return 'originId and destinationId must be different.'
  }

  if (!isValidDateString(departDate)) {
    return 'departDate must use YYYY-MM-DD format.'
  }

  if (isPastDate(departDate)) {
    return 'departDate cannot be in the past.'
  }

  return null
}

const buildRouteSuggestions = ({ originId, destinationId, departDate }) => {
  const dateStart = new Date(`${departDate}T00:00:00`)

  return routeTemplates.map((template, index) => {
    const seed = deterministicSeed(originId, destinationId, departDate, template.mode)
    const departureMinutesOffset = (seed % 540) + index * 45
    const departureTime = new Date(dateStart)
    departureTime.setMinutes(departureMinutesOffset)

    const durationJitter = seed % 60
    const durationMinutes = template.baseDuration + durationJitter
    const arrivalTime = new Date(departureTime)
    arrivalTime.setMinutes(departureTime.getMinutes() + durationMinutes)

    const costJitter = seed % 70
    const estimatedCostUsd = template.baseCost + costJitter

    return {
      id: `route_${index + 1}`,
      mode: template.mode,
      provider: template.provider,
      departureTime: departureTime.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
      durationMinutes,
      stops: template.stops,
      estimatedCostUsd
    }
  })
}

module.exports = {
  locations,
  autocompleteLocations,
  validateSuggestionsQuery,
  buildRouteSuggestions,
  isValidDateString,
  getTodayDateString
}
