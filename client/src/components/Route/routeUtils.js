const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const parseFilterBound = (value) => {
  if (value === '' || value == null) return null

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null

  return parsed
}

const getRangeError = (range = {}, label) => {
  const min = parseFilterBound(range.min)
  const max = parseFilterBound(range.max)

  if (min != null && max != null && min > max) {
    return `Minimum ${label} cannot be greater than maximum ${label}.`
  }

  return ''
}

export const getTodayDateString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const isValidDateString = (value) => DATE_REGEX.test(value)

export const isDateBeforeToday = (value, today = getTodayDateString()) => {
  if (!isValidDateString(value)) return true
  return value < today
}

export const validateCreateRouteInput = ({ origin, destination, departDate, mpg}) => {
  const errors = {}
  const today = getTodayDateString()

  if (!origin?.id) {
    errors.origin = 'Please select an origin from suggestions.'
  }

  if (!destination?.id) {
    errors.destination = 'Please select a destination from suggestions.'
  }

  if (origin?.id && destination?.id && origin.id === destination.id) {
    errors.destination = 'Origin and destination cannot be the same.'
  }

  if (!departDate) {
    errors.departDate = 'Please choose a departure date.'
  } else if (!isValidDateString(departDate) || isDateBeforeToday(departDate, today)) {
    errors.departDate = 'Departure date cannot be in the past.'
  }

  if (mpg !== '' && (isNaN(Number(mpg)) || Number(mpg) <= 0)) {
    errors.mpg = 'Please enter a valid MPG greater than 0.'
  }

  return errors
}

export const getTravelTimeFilterError = (travelTime = {}) => getRangeError(travelTime, 'travel time')
export const getCostFilterError = (cost = {}) => getRangeError(cost, 'cost')
export const getDistanceFilterError = (distance = {}) => getRangeError(distance, 'distance')
export const getStopsFilterError = (stops = {}) => getRangeError(stops, 'stops')

export const getRouteStopCount = (route = {}) => {
  let stopCount = -1

  for (const leg of route.legs || []) {
    if (leg.segments && leg.segments.length > 0) {
      stopCount += leg.segments.length
    } else {
      stopCount += 1
    }
  }

  return Math.max(0, stopCount)
}

export const getRouteModeSummary = (route = {}) => {
  const modes = (route.legs || []).map((leg) => leg.transportationMode).filter(Boolean)
  const uniqueModes = modes.filter((mode, index) => index === 0 || mode !== modes[index - 1])

  return uniqueModes.join(' → ') || 'Unknown'
}

export const getRouteProviderSummary = (route = {}) => {
  const providers = (route.legs || []).flatMap((leg) => leg.provider).filter(Boolean)

  if (providers.length > 2) {
    return `${providers[0]}, ... , ${providers[providers.length - 1]}`
  }

  return providers.join(', ') || 'Unknown'
}

export const getRouteCostText = (route = {}) => {
  if (route.localizedFare) return route.localizedFare
  if (route.totalCost !== undefined && route.totalCost != null) {
    return `Estimated Cost: $${route.totalCost}`
  }

  return 'Fare Not Available'
}

export const getComparisonWinner = (firstValue, secondValue, preference = 'lower') => {
  const first = Number(firstValue)
  const second = Number(secondValue)

  if (!Number.isFinite(first) || !Number.isFinite(second) || first === second) return null

  if (preference === 'higher') {
    return first > second ? 'first' : 'second'
  }

  return first < second ? 'first' : 'second'
}

export const getRouteFilterErrors = (filters = {}) => ({
  travelTime: getTravelTimeFilterError(filters.travelTime),
  cost: getCostFilterError(filters.cost),
  distance: getDistanceFilterError(filters.distance),
  stops: getStopsFilterError(filters.stops)
})

export const applyRouteFilters = (routes = [], filters = {}) => {
  const travelTime = filters.travelTime || {}
  const cost = filters.cost || {}
  const distance = filters.distance || {}
  const stops = filters.stops || {}
  const errors = getRouteFilterErrors(filters)

  if (Object.values(errors).some(Boolean)) {
    return []
  }

  const minDuration = parseFilterBound(travelTime.min)
  const maxDuration = parseFilterBound(travelTime.max)
  const minCost = parseFilterBound(cost.min)
  const maxCost = parseFilterBound(cost.max)
  const minDistance = parseFilterBound(distance.min)
  const maxDistance = parseFilterBound(distance.max)
  const minStops = parseFilterBound(stops.min)
  const maxStops = parseFilterBound(stops.max)

  return routes.filter((route) => {
    const duration = Number(route.totalDuration) || 0
    const totalCost = Number(route.totalCost) || 0
    const totalDistance = Number(route.totalDistance) || 0
    const stopCount = getRouteStopCount(route)

    if (minDuration != null && duration < minDuration) return false
    if (maxDuration != null && duration > maxDuration) return false
    if (minCost != null && totalCost < minCost) return false
    if (maxCost != null && totalCost > maxCost) return false
    if (minDistance != null && totalDistance < minDistance) return false
    if (maxDistance != null && totalDistance > maxDistance) return false
    if (minStops != null && stopCount < minStops) return false
    if (maxStops != null && stopCount > maxStops) return false

    return true
  })
}

export const sortRoutes = (routes = [], sortBy = {}) => {
  const { key, order } = sortBy
  if (!key || !order) return routes

  if (key === 'legs.length') {
    return [...routes].sort((a, b) => {
      const valueA = a.legs?.length || 0
      const valueB = b.legs?.length || 0

      if (order === 'asc') {
        return valueA - valueB
      }

      return valueB - valueA
    })
  }

  return [...routes].sort((a, b) => {
    const valueA = Number(a[key]) || 0
    const valueB = Number(b[key]) || 0

    if (order === 'asc') {
      return valueA - valueB
    }

    return valueB - valueA
  })
}

// displays time in user's local timezone (not sure if that will matter for flights)
export const formatTimeRange = (departureTime, arrivalTime) => {
  const departure = new Date(departureTime)
  const arrival = new Date(arrivalTime)

  const options = { hour: 'numeric', minute: '2-digit' }
  return `${departure.toLocaleTimeString([], options)} - ${arrival.toLocaleTimeString([], options)}`
}
