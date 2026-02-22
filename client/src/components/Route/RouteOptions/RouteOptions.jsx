import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getRouteSuggestions, addRoute } from '../../../services/routeServices'
import { formatTimeRange } from '../routeUtils'
import './RouteOptions.css'

// Sorting options can be added here
// const sortOptions = [] 

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${remainder}m`
}

export default function RouteOptions() {
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routes, setRoutes] = useState([])
  
  // Something like this
  //const [modeFilter, setModeFilter] = useState('All')
  //const [sortBy, setSortBy] = useState('cost-asc')

  const originId = searchParams.get('originId') || ''
  const originName = searchParams.get('originName') || 'Unknown Origin'
  const destinationId = searchParams.get('destinationId') || ''
  const destinationName = searchParams.get('destinationName') || 'Unknown Destination'
  const departDate = searchParams.get('departDate') || ''

  useEffect(() => {
    if (!originId || !destinationId || !departDate) {
      setError('Missing search details. Please create a route again.')
      setLoading(false)
      return
    }

    const loadSuggestions = async () => {
      try {
        setLoading(true)
        const response = await getRouteSuggestions({
          originId,
          destinationId,
          departDate
        })
        setRoutes(response.routes)
      } catch (requestError) {
        const message = requestError.response?.data?.error || 'Could not load route suggestions.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
  }, [departDate, destinationId, originId])

/* ---------- FOR TESTING ADD ROUTE TO TRIP --------------*/
  //trip-id hardcoded for testing add route functions - replace with actual trip/route ID when integrated with choosing a trip to add/creating a new trip
  // also hardcoding route details for testing - replace with actual route details from route suggestions when integrated with choosing a route to add
  const handleAddRoute = async (route) => {
      try {
        const addedRoute = await addRoute("699a444e75d3995896fca38b", { 
          name: `${originName} to ${destinationName} route`, // future implementation - generate route name based on origin/destination/time or allow user to input custom name
          origin: route.origin,
          destination: route.destination,
          departAt: route.departAt,
          arriveAt: route.arriveAt,
          totalDuration: route.totalDuration,
          totalDistance: route.totalDistance,
          totalCost: route.totalCost,
          legs: route.legs
        })
        console.log("Added Route:", addedRoute)
      } catch (err) {
        console.error(err)
      }
    }
  /* ---------- DONE --------------*/

// Filtering and sorting to be implemented
/*
  const availableModes = useMemo()
  const displayedRoutes = useMemo()
*/

  return (
    <section className="route-options-page">
      <header className="route-options-header">
        <h1>Route Suggestions</h1>
        <p>
          {originName} to {destinationName} on {departDate}
        </p>
      </header>

      {/* Implement filter and sorting */}
      
      {loading && <p>Loading route suggestions...</p>}
      {!loading && error && <p className="route-options-error">{error}</p>}
      {!loading && !error && routes.length === 0 && <p>No matching routes found.</p>}

      {/* Change to displayedRoutes when filtering/sorting is implemented */}
      {!loading && !error && routes.length > 0 && (
        <ul className="route-options-list">
          {routes.map((route) => ( 
            <li key={route.id} className="route-option-card">
              <h2>{route.legs.map(leg => leg.transportationMode).join(' → ')}</h2>
              <p>Provider: {route.legs.map(leg => leg.provider).join(', ')}</p>
              <p>{formatTimeRange(route.departAt, route.arriveAt)}</p>
              <p>Distance: {route.totalDistance} miles</p>
              <p>Duration: {formatDuration(route.totalDuration)}</p>
              <p>Stops: {route.legs.length - 1}</p>
              <p>Estimated Cost: ${route.totalCost}</p>
              <button className="route-option-select-button"
               onClick={() => handleAddRoute(route)}>Select This Route</button>
            </li>
          ))}
        </ul>
      )}

      <Link to="/create-route" className="route-options-back-link">
        Edit Route Search
      </Link>
    </section>
  )
}
