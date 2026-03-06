import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { getRouteSuggestions, addRoute } from '../../../services/routeServices'
// import { formatTimeRange } from '../routeUtils'
import './RouteOptions.css'

// Sorting options can be added here
// const sortOptions = [] 

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`
}

const formatTime = (isoString) => {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
};

export default function RouteOptions() {
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routes, setRoutes] = useState([])

  const navigate = useNavigate();
  
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

    // TODO: memoize or cache suggestions for view route details to route options to avoid unnecessary API calls
    const loadSuggestions = async () => {
      try {
        setLoading(true)
        const response = await getRouteSuggestions({
          originId,
          originName,
          destinationId,
          destinationName,
          departDate
        })
        
        const sortedRoutes = [...(response.routes || [])].sort((a, b) => {
          const durationA = Number(a.totalDuration) || 0
          const durationB = Number(b.totalDuration) || 0
          if (durationA !== durationB) return durationA - durationB

          const costA = Number(a.totalCost) || 0
          const costB = Number(b.totalCost) || 0
          return costA - costB
        })

        setRoutes(sortedRoutes)

        //setRoutes(response.routes)
      } catch (requestError) {
        const message = requestError.response?.data?.error || 'Could not load route suggestions.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
  }, [departDate, destinationId, originId, originName, destinationName])

/* ---------- FOR TESTING ADD ROUTE TO TRIP --------------*/
  //trip-id hardcoded for testing add route functions - replace with actual trip/route ID when integrated with choosing a trip to add/creating a new trip
  // also hardcoding route details for testing - replace with actual route details from route suggestions when integrated with choosing a route to add
  const handleAddRoute = async (route) => {
      try {
        const addedRoute = await addRoute("699f7e595285b32fed6ae442", { 
          name: `${originName.split(",")[0].trim()} to ${destinationName.split(",")[0].trim()} route`, // future implementation - generate route name based on origin/destination/time or allow user to input custom name
          origin: route.origin,
          destination: route.destination,
          departAt: route.departAt,
          arriveAt: route.arriveAt,
          // totalCost: route.totalCost,
          // totalDuration: route.totalDuration,
          // totalDistance: route.totalDistance,
          createdAt: new Date().toISOString(),
          editedAt: new Date().toISOString(),
          totalDuration: Number(route.totalDuration),
          totalDistance: Number(route.totalDistance),
          totalCost: Number(route.totalCost),
          legs: route.legs
        })
        console.log("Added Route:", addedRoute)
      } catch (err) {
        console.error("Validation Error Details:", err.response?.data)
      }
    }
  /* ---------- DONE --------------*/

  // navigate to route detail page for a specific route
  const handleViewRoute = async (route) => {
    navigate('/view-route-details', { state: {selectedRoute: route } });
  }

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
          {routes.map((route, index) => {
            console.log(`Rendering Route ${index + 1}:`, route);

            return (
              <li key={route.id} className="route-option-card">
                {/* Left Column: Mode and Provider */}
                <div className="route-main-info">
                  <h2>
                    {route.legs.map((leg) => {
                        // If there are segments, repeat the mode N times
                        if (leg.segments && leg.segments.length === 2) {
                          return Array(leg.segments.length)
                            .fill(leg.transportationMode)
                            .join(" → ");
                        } else if (leg.segments && leg.segments.length > 2) {
                          return `${leg.transportationMode} → ... → ${leg.transportationMode}`;
                        }
                        // Otherwise, just show the mode once
                        return leg.transportationMode;
                      })}
                  </h2>

                  <p>
                    <strong>Provider: </strong> {(() => {
                                const providers = route.legs.flatMap(leg => leg.provider);
                                return providers.length > 2 ? `${providers[0]}, ... , ${providers[providers.length - 1]}` : providers.join(", ");
                            })()}
                  </p>
                </div>

                {/* Middle Column: Visual Route Runway */}
                <div className="route-visual-path">
                  {/* <p>{formatTimeRange(route.departAt, route.arriveAt)}</p> */}

                  <div className="time-block">
                      <strong>{formatTime(route.departAt)}</strong>
                      <p>{new Date(route.departAt).toLocaleDateString()}</p>
                      <p className="station-subtext">{route.legs[0]?.origin?.name || "Origin"}</p>
                  </div>

                  <div className="duration-arrow">
                    <span>
                      {(() => {
                          const totalMinutes = route.totalDuration;
                          const h = Math.floor(totalMinutes / 60);
                          const m = totalMinutes % 60;
                          return `${h > 0 ? h + ' hr ' : ''}${m} min`;
                      })()}
                    </span>
                    <hr />
                    <span className="stop-count">
                       {(() => {
                        // Add segment counts and leg counts if available, otherwise fallback to leg count for stop count
                        var stopCount = -1; // Start at -1 to not count the first leg as a stop
                        for (let leg of route.legs) {
                          if (leg.segments && leg.segments.length > 0) {
                            stopCount += leg.segments.length;
                          } else {
                            stopCount += 1; // If no segments, each leg is a direct connection (1 stop)
                          }
                        }
                        if (stopCount <= 0) return "Direct (Non-stop)";
                        return `${stopCount} ${stopCount === 1 ? 'Stop' : 'Stops'}`;
                      })()}
                    </span>
                  </div>

                  <div className="time-block" style={{textAlign: "right"}}>
                    <strong>{formatTime(route.arriveAt)}</strong>
                    <p style={{textAlign: "right", textWrap: "balance"}}>{new Date(route.arriveAt).toLocaleDateString()}</p>
                    <p className="station-subtext" style={{textAlign: "right"}}>{route.legs[route.legs.length - 1]?.destination?.name || "Destination"}</p>
                  </div>
                </div>

                {/* Right Column: Key Details and Button */}
                <div className="route-details-column">
                  <div className="meta-stats">
                    <p><strong>Distance: {route.totalDistance} miles</strong></p>

                    <p><strong>Duration: {formatDuration(route.totalDuration)}</strong></p>

                    <p>
                      <strong>
                        Stops: {(() => {
                          
                        // Add segment counts and leg counts if available, otherwise fallback to leg count for stop count
                        var stopCount = -1; // Start at -1 to not count the first leg as a stop
                        for (let leg of route.legs) {
                          if (leg.segments && leg.segments.length > 0) {
                            stopCount += leg.segments.length;
                          } else {
                            stopCount += 1; // If no segments, each leg is a direct connection (1 stop)
                          }
                        }
                        if (stopCount <= 0) return "Direct (Non-stop)";
                        return `${stopCount} ${stopCount === 1 ? 'Transfer' : 'Transfers'}`;
                        })()}
                      </strong>
                    </p>

                    <p>
                      <strong>
                        {(route.localizedFare
                        ? route.localizedFare
                        : (route.totalCost !== undefined && route.totalCost != null
                          ? `Estimated Cost: $${route.totalCost}`
                          : "Fare Not Available"))}
                        </strong>
                    </p>
                  </div>

                  <button className="route-option-select-button"onClick={() => handleAddRoute(route)}>
                    Select This Route
                  </button>

                  <button className="route-option-details-button"onClick={() => handleViewRoute(route)}>
                    View Route Details
                  </button>

                </div>
              </li>
            );
        })}
        </ul>
      )}

      <Link to="/create-route" className="route-options-back-link">
        Edit Route Search
      </Link>
    </section>
  )
}
