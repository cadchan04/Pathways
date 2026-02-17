import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchRouteSuggestions } from '../../../services/routeServices'
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
        const response = await fetchRouteSuggestions({
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
              <h2>{route.mode}</h2>
              <p>Provider: {route.provider}</p>
              <p>{formatTimeRange(route.departureTime, route.arrivalTime)}</p>
              <p>Duration: {formatDuration(route.durationMinutes)}</p>
              <p>Stops: {route.stops}</p>
              <p>Estimated Cost: ${route.estimatedCostUsd}</p>
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
