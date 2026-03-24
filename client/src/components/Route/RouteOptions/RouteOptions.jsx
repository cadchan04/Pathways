import React, { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { getRouteSuggestions, addRoute, getMultiModalRoutes } from '../../../services/routeServices'
import { getTrips } from '../../../services/tripServices'
import { useUser } from '../../../../context/UserContext'
import './RouteOptions.css'
import { getWeatherForecast } from '../../../services/weatherServices';



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

function getWeatherDescription(code) {
  const map = {
    0: { text: "Clear", icon: "☀️" },
    1: { text: "Mostly Clear", icon: "🌤️" },
    2: { text: "Partly Cloudy", icon: "⛅" },
    3: { text: "Overcast", icon: "☁️" },
    45: { text: "Fog", icon: "🌫️" },
    48: { text: "Fog", icon: "🌫️" },
    51: { text: "Light Drizzle", icon: "🌦️" },
    61: { text: "Light Rain", icon: "🌧️" },
    71: { text: "Snow", icon: "❄️" },
    80: { text: "Rain Showers", icon: "🌧️" },
    95: { text: "Thunderstorm", icon: "⛈️" }
  };

  return map[code] || { text: "Unknown", icon: "❓" };
}

export default function RouteOptions() {
  const [searchParams] = useSearchParams()
  const { dbUser } = useUser()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routes, setRoutes] = useState([])
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState('');
  const desc = weather ? getWeatherDescription(weather.weatherCode) : null;
  const [routeToAdd, setRouteToAdd] = useState(null)
  const [showAddRouteModal, setShowAddRouteModal] = useState(false)
  const [modalStep, setModalStep] = useState('choose-action')
  const [trips, setTrips] = useState([])
  const [loadingTrips, setLoadingTrips] = useState(false)
  const [tripsError, setTripsError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)


  const navigate = useNavigate();

  // Something like this
  //const [modeFilter, setModeFilter] = useState('All')
  //const [sortBy, setSortBy] = useState('cost-asc')

  const originId = searchParams.get('originId') || ''
  const originName = searchParams.get('originName') || 'Unknown Origin'
  const destinationId = searchParams.get('destinationId') || ''
  const destinationName = searchParams.get('destinationName') || 'Unknown Destination'
  const departDate = searchParams.get('departDate') || ''

  const originLat = parseFloat(searchParams.get('originLat'))
  const originLng = parseFloat(searchParams.get('originLng'))

  const destinationLat = parseFloat(searchParams.get('destinationLat'))
  const destinationLng = parseFloat(searchParams.get('destinationLng'))

  useEffect(() => {
    if (!originId || !destinationId || !departDate) {
      setError('Missing search details. Please create a route again.')
      setLoading(false)
      return
    }

    const loadSuggestions = async () => {
      try {
        setLoading(true)
        const response = await getMultiModalRoutes({
          origin: {
            name: originName,
            id: originId,
            coordinates: {
              lat: originLat,
              lng: originLng
            }
          },
          destination: {
            name: destinationName,
            id: destinationId,
            coordinates: {
              lat: destinationLat,
              lng: destinationLng
            }
          },
          date: departDate
        })

        console.log("Multimodal routes:", response)

        console.log("Origin coordinates:", originLat, originLng)
        console.log("Destination coordinates:", destinationLat, destinationLng)

        const sortedRoutes = [...(response || [])].sort((a, b) => {
          const durationA = Number(a.totalDuration) || 0
          const durationB = Number(b.totalDuration) || 0
          if (durationA !== durationB) return durationA - durationB

          const costA = Number(a.totalCost) || 0
          const costB = Number(b.totalCost) || 0
          return costA - costB
        })

        setRoutes(sortedRoutes)

      } catch (requestError) {
        const message = requestError.response?.data?.error || 'Could not load route suggestions.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
  }, [departDate, destinationId, originId, originName, destinationName])

  useEffect(() => {
    if (!showAddRouteModal || modalStep !== 'choose-trip') return
    if (!dbUser?._id) {
      setTrips([])
      setTripsError('Your profile is still loading. Please try again.')
      return
    }

    let cancelled = false
    const loadTrips = async () => {
      setLoadingTrips(true)
      setTripsError('')
      try {
        const data = await getTrips(dbUser._id)
        if (!cancelled) setTrips(data || [])
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading trips:', err)
          setTripsError('Could not load your trips right now. Please try again.')
        }
      } finally {
        if (!cancelled) setLoadingTrips(false)
      }
    }

    loadTrips()
    return () => {
      cancelled = true
    }
  }, [showAddRouteModal, modalStep, dbUser?._id])

  const buildRoutePayload = (route) => {
    const locationFromName = (locationData = {}, fallback = 'Unknown') => {
      const rawAddress = locationData?.address || locationData?.name || fallback
      const parts = String(rawAddress).split(',').map((p) => p.trim()).filter(Boolean)
      const hasUS = parts.some((p) => /^(united states|united states of america|usa|us)$/i.test(p))
      let shortName = parts[0] || fallback
      if (hasUS) {
        shortName = parts[1] ? `${parts[0]}, ${parts[1]}, USA` : `${parts[0]}, USA`
      } else if (parts.length >= 2) {
        shortName = `${parts[0]}, ${parts[1]}`
      }
      return {
        ...locationData,
        name: shortName,
        address: rawAddress
      }
    }

    return {
      name: `${locationFromName(route.origin, 'Route Origin').name} to ${locationFromName(route.destination, 'Route Destination').name}`,
      origin: locationFromName(route.origin, 'Route Origin'),
      destination: locationFromName(route.destination, 'Route Destination'),
      departAt: route.departAt,
      arriveAt: route.arriveAt,
      createdAt: new Date().toISOString(),
      editedAt: new Date().toISOString(),
      totalDuration: Number(route.totalDuration),
      totalDistance: Number(route.totalDistance),
      totalCost: Number(route.totalCost),
      legs: (route.legs || []).map((leg) => ({
        ...leg,
        origin: locationFromName(leg.origin, 'Leg Origin'),
        destination: locationFromName(leg.destination, 'Leg Destination'),
        segments: (leg.segments || []).map((segment) => ({
          ...segment,
          origin: locationFromName(segment.origin, 'Segment Origin'),
          destination: locationFromName(segment.destination, 'Segment Destination')
        }))
      }))
    }
  }

  const closeAddRouteModal = () => {
    if (isSubmitting) return
    setShowAddRouteModal(false)
    setModalStep('choose-action')
    setTripsError('')
    setSubmitError('')
  }

  const handleAddRoute = (route) => {
    setRouteToAdd(route)
    setShowAddRouteModal(true)
    setModalStep('choose-action')
    setTripsError('')
    setSubmitError('')
  }

  const handleConfirmAddToTrip = async (tripId) => {
    if (!routeToAdd) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      await addRoute(tripId, buildRoutePayload(routeToAdd))
      closeAddRouteModal()
      navigate(`/view-trip-details/${tripId}`)
    } catch (err) {
      console.error('Error adding route to trip:', err)
      setSubmitError(err?.response?.data?.error || 'Could not add route. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateNewTrip = () => {
    closeAddRouteModal()
    navigate('/create-trip', { state: { pendingRoute: routeToAdd } })
  }

  // navigate to route detail page for a specific route
  const handleViewRoute = async (route) => {
    navigate('/view-route-details', { state: { selectedRoute: route } });
  }

  // Weather
  useEffect(() => {
    if (!routes.length || !departDate) return;
  
    const destination = routes[0].destination || routes[0].legs[routes[0].legs.length - 1].destination;
  
    const lat = destination?.coordinates?.lat;
    const lon = destination?.coordinates?.lng;
  
    console.log("Weather coords:", lat, lon);
  
    if (!lat || !lon) {
      setWeatherError("Weather unavailable");
      return;
    }
  
    const loadWeather = async () => {
      try {
        const forecast = await getWeatherForecast(lat, lon, departDate);
        setWeather(forecast);
      } catch (err) {
        console.error("Weather error:", err);
        setWeatherError("Weather unavailable");
      }
    };
  
    loadWeather();
  }, [routes, departDate]);
  
  
// Filtering and sorting to be implemented
/*
  const availableModes = useMemo()
  const displayedRoutes = useMemo()
*/

  return (
    <section className="route-options-page">
<header className="route-options-header">
  <div className="header-left">
    <h1>Route Suggestions</h1>
    <p>{originName} to {destinationName} on {departDate}</p>
  </div>

  <div className="header-right">
    {weather && weather.weatherCode !== undefined && (
      <div className="weather-box">
        <p className="weather-destination">
          {destinationName.split(",").slice(0, 2).join(",")}
        </p>

        <div className="weather-main">
          <span className="weather-icon">{desc.icon}</span>
          <span className="weather-temp">{weather.highTemp}°F</span>
        </div>

        <p className="weather-precip">{weather.precipitation}% chance of rain</p>

        <p className="weather-date">
          {new Date(departDate + "T00:00").toLocaleDateString("en-US", {
          month: "long",
          day: "numeric"
        })}
        </p>
      </div>
    )}

    {weatherError && (
      <div className="weather-box">
        <p>{weatherError}</p>
      </div>
    )}
  </div>
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
              <li key={index} className="route-option-card">
                {/* Left Column: Mode and Provider */}
                <div className="route-main-info">
                  <h2>
                    {/* {route.legs.map((leg) => {
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
                      })} */}
                    {(() => {
                      const modes = route.legs.map(l => l.transportationMode)

                      const uniqueModes = modes.filter(
                        (mode, i) => i === 0 || mode !== modes[i - 1]
                      )

                      return uniqueModes.join(" → ")
                    })()}
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

                  <div className="time-block" style={{ textAlign: "right" }}>
                    <strong>{formatTime(route.arriveAt)}</strong>
                    <p style={{ textAlign: "right", textWrap: "balance" }}>{new Date(route.arriveAt).toLocaleDateString()}</p>
                    <p className="station-subtext" style={{ textAlign: "right" }}>{route.legs[route.legs.length - 1]?.destination?.name || "Destination"}</p>
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

                  <button className="route-option-select-button" onClick={() => handleAddRoute(route)}>
                    Add Route
                  </button>

                  <button className="route-option-details-button" onClick={() => handleViewRoute(route)}>
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

      {showAddRouteModal && (
        <div className="route-modal-overlay" onClick={closeAddRouteModal}>
          <div className="route-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Add route to trip</h3>

            {modalStep === 'choose-action' && (
              <>
                <p className="route-modal-lead">
                  Choose whether you want to add this route to an existing trip or create a new one.
                </p>
                <div className="route-modal-actions">
                  <button
                    className="route-modal-primary"
                    onClick={() => setModalStep('choose-trip')}
                  >
                    Add to existing trip
                  </button>
                  <button
                    className="route-modal-primary"
                    onClick={handleCreateNewTrip}
                  >
                    Create new trip
                  </button>
                  <button className="route-modal-secondary" onClick={closeAddRouteModal}>
                    Cancel
                  </button>
                </div>
              </>
            )}

            {modalStep === 'choose-trip' && (
              <>
                <button
                  className="route-modal-back"
                  onClick={() => {
                    if (isSubmitting) return
                    setModalStep('choose-action')
                    setSubmitError('')
                  }}
                >
                  ← Back
                </button>
                <p className="route-modal-lead">Select one of your trips:</p>

                {loadingTrips && <p>Loading trips...</p>}
                {tripsError && <p className="route-modal-error">{tripsError}</p>}
                {!loadingTrips && !tripsError && trips.length === 0 && (
                  <p>You do not have any trips yet. Create a new trip first.</p>
                )}

                {!loadingTrips && trips.length > 0 && (
                  <ul className="route-modal-trip-list">
                    {trips.map((trip) => (
                      <li key={trip._id}>
                        <button
                          className="route-modal-trip-row"
                          onClick={() => handleConfirmAddToTrip(trip._id)}
                          disabled={isSubmitting}
                        >
                          <span>{trip.name?.trim() || 'Untitled Trip'}</span>
                          <small>
                            {(trip.startDate ? new Date(trip.startDate).toLocaleDateString() : 'TBD')}
                            {' -> '}
                            {(trip.endDate ? new Date(trip.endDate).toLocaleDateString() : 'TBD')}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {submitError && <p className="route-modal-error">{submitError}</p>}

                <div className="route-modal-actions">
                  <button className="route-modal-secondary" onClick={closeAddRouteModal} disabled={isSubmitting}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
