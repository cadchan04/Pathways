const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

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

export const validateCreateRouteInput = ({ origin, destination, departDate}) => {
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

  return errors
}

// filtering and sorting to be implemented 
// export const applyRouteFiltersAndSort = (routes, { modeFilter = 'All', sortBy = 'cost-asc' }) => { }

// displays time in user's local timezone (not sure if that will matter for flights)
export const formatTimeRange = (departureTime, arrivalTime) => {
  const departure = new Date(departureTime)
  const arrival = new Date(arrivalTime)

  const options = { hour: 'numeric', minute: '2-digit' }
  return `${departure.toLocaleTimeString([], options)} - ${arrival.toLocaleTimeString([], options)}`
}
