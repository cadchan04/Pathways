import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { addRoute, getMultiModalRoutes, updateRoute } from '../../../services/routeServices'
// import { getRouteSuggestions, addRoute, getMultiModalRoutes } from '../../../services/routeServices'
import { getTrips } from '../../../services/tripServices'
import { useUser } from '../../../../context/useUser'
import './RouteOptions.css'
import { getWeatherForecast } from '../../../services/weatherServices';
import {
  applyRouteFilters,
  getComparisonWinner,
  getRouteCostText,
  getRouteFilterErrors,
  getRouteModeSummary,
  getRouteProviderSummary,
  getRouteStopCount
} from '../routeUtils'



const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`
}

const formatTime = (isoString) => {
  if (!isoString) return "N/A";
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
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
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { dbUser } = useUser()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routes, setRoutes] = useState([])
  const [providers, setProviders] = useState([])
  const [selectedProviders, setSelectedProviders] = useState([])
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
  const [pendingTripId, setPendingTripId] = useState(null);
  const [comparisonRoutes, setComparisonRoutes] = useState([null, null])
  const [filters, setFilters] = useState({
    travelTime: {
      min: '',
      max: ''
    },
    cost: {
      min: '',
      max: ''
    },
    distance: {
      min: '',
      max: ''
    },
    stops: {
      min: '',
      max: ''
    }
  })


  const navigate = useNavigate();
  const comparisonPanelRef = useRef(null)

  // Something like this
  //const [modeFilter, setModeFilter] = useState('All')
  //const [sortBy, setSortBy] = useState('cost-asc')

  const originId = searchParams.get('originId') || location.state?.originalRoute?.origin?.id || ''
  const originName = searchParams.get('originName') || location.state?.originalRoute?.origin?.name || 'Unknown Origin'
  const destinationId = searchParams.get('destinationId') || location.state?.originalRoute?.destination?.id || ''
  const destinationName = searchParams.get('destinationName') || location.state?.originalRoute?.destination?.name || 'Unknown Destination'
  const departDate = searchParams.get('departDate') || location.state?.originalRoute?.departAt?.split('T')[0] || ''
  const mpg = searchParams.get('mpg') || location.state?.originalRoute?.mpg || ''

  const originLat = parseFloat(searchParams.get('originLat'))
  const originLng = parseFloat(searchParams.get('originLng'))

  const destinationLat = parseFloat(searchParams.get('destinationLat'))
  const destinationLng = parseFloat(searchParams.get('destinationLng'))
  const filterErrors = getRouteFilterErrors(filters)


  // Handing the toggling of providers from the sidebar
  const handleProviderToggle = (name) => {
    setSelectedProviders((prevSelected) => {
      if (prevSelected.includes(name)) {
        // Remove it
        return prevSelected.filter((p) => p !== name);
      } else {
        // Add it
        return [...prevSelected, name];
      }
    });
  };

  // Only display the routes of the selected providers and by filter options
  const displayedRoutes = useMemo(() => {
    const filteredRoutes = applyRouteFilters(routes, filters);
  
    return filteredRoutes.filter(route => {
      if (selectedProviders.length === 0) return false;
  
      const routeProviders = route.legs.flatMap(leg => {
        if (Array.isArray(leg.provider)) return leg.provider;
        return leg.provider ? [leg.provider] : [];
      });
  
      return routeProviders.every(p => selectedProviders.includes(p));
    });
  }, [routes, filters, selectedProviders]);

  useEffect(() => {
    console.log(location.state?.isRegenerating ? "Loading regenerated routes..." : "Loading routes...")
    if (!location.state?.isRegenerating && (!originId || !destinationId || !departDate)) {
      setError('Missing search details. Please create a route again.')
      setLoading(false)
      return
    }

    const loadSuggestions = async () => {
      // If we're coming from a regeneration, we should already have the routes in state and can skip the API call
      if (location.state?.isRegenerating) {
        setRoutes(location.state?.regeneratedRoutes || [])
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)

        const mpgNumber = mpg.trim() !== '' ? Number(mpg) : undefined

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
          date: departDate,
          mpg: mpgNumber
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
  }, [departDate, destinationId, originId, originName, destinationName, destinationLat, destinationLng, originLat, originLng])

  // Load providers for all routes after they are fetched
  useEffect(() => {
    if (providers && Object.keys(providers).length > 0) return
    if (!routes.length) return;

    let isMounted = true;

    const loadProviders = async () => {
      const providerModes = {};
      const providerSet = new Set();
      
      routes.forEach(route => {
        route.legs.forEach(leg => {
          const mode = leg.transportationMode || 'Unknown Mode';
          
          // Create a set for this mode if it doesn't exist
          if (!providerModes[mode]) {
              providerModes[mode] = new Set(); 
          }

          const addProvider = (p) => {
            // Add provider to set of all providers and add to this mode's provider set
            providerSet.add(p);
            providerModes[mode].add(p);
          }

          if (Array.isArray(leg.provider)) {
            leg.provider.forEach(p => addProvider(p));
          } else if (leg.provider) {
            addProvider(leg.provider);
          }
        });
      });

      if (isMounted) {
        const formattedProviders = {};
        Object.keys(providerModes).forEach(mode => {
          formattedProviders[mode] = Array.from(providerModes[mode]).sort();
        });
        setProviders(formattedProviders);
        setSelectedProviders(Array.from(providerSet).sort());
        //console.log("Extracted providers:", providerArray);
      }
    };

    loadProviders();

    return () => { isMounted = false; };
  }, [routes, providers]);

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
    if (!dbUser?._id) {
      setSubmitError('Your profile is still loading. Please try again.')
      return
    }

    // perform date validation checks of route before adding to trip
    const selectedTrip = trips.find(t => t._id === tripId);
    if (selectedTrip && selectedTrip.startDate && selectedTrip.endDate) {
      const routeDate = new Date(routeToAdd.departAt).setHours(0,0,0,0);
      const tripStart = new Date(selectedTrip.startDate).setHours(0,0,0,0);
      const tripEnd = new Date(selectedTrip.endDate).setHours(0,0,0,0);

      if (routeDate < tripStart || routeDate > tripEnd) {
        setPendingTripId(tripId);
        setModalStep('date-warning');
        return;
      }
    }

    setIsSubmitting(true)
    setSubmitError('')
    try {
      await addRoute(tripId, buildRoutePayload(routeToAdd), dbUser._id)
      closeAddRouteModal()
      navigate(`/view-trip-details/${tripId}`)
    } catch (err) {
      console.error('Error adding route to trip:', err)
      setSubmitError(err?.response?.data?.error || 'Could not add route. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // const handleAddRoute = (route) => {
  //   setRouteToAdd(route)
  //   setShowAddRouteModal(true)
  //   setModalStep('choose-action')
  //   setTripsError('')
  //   setSubmitError('')
  // }

  // const handleConfirmAddToTrip = async (tripId) => {
  //   if (!routeToAdd) return
  //   if (!dbUser?._id) {
  //     setSubmitError('Your profile is still loading. Please try again.')
  //     return
  //   }
  //   setIsSubmitting(true)
  //   setSubmitError('')
  //   try {
  //     await addRoute(tripId, buildRoutePayload(routeToAdd), dbUser._id)
  //     closeAddRouteModal()
  //     navigate(`/view-trip-details/${tripId}`)
  //   } catch (err) {
  //     console.error('Error adding route to trip:', err)
  //     setSubmitError(err?.response?.data?.error || 'Could not add route. Please try again.')
  //   } finally {
  //     setIsSubmitting(false)
  //   }
  // }

  // handle actual API call to add route to trip after confirming date warning
  const executeAddRoute = async (tripId) => {
    if (!routeToAdd || !dbUser?._id) return;
    
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await addRoute(tripId, buildRoutePayload(routeToAdd), dbUser._id);
      closeAddRouteModal();
      navigate(`/view-trip-details/${tripId}`);
    } catch (err) {
      console.error('Error adding route to trip:', err);
      setSubmitError(err?.response?.data?.error || 'Could not add route. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewTrip = () => {
    closeAddRouteModal()
    navigate('/create-trip', { state: { pendingRoute: routeToAdd } })
  }

  // navigate to route detail page for a specific route
  const handleViewRoute = async (route) => {
    if (location.state?.isRegenerating) {
      navigate('/view-route-details', { state: { fromRegeneration: true, selectedRoute: route, tripId: location.state.tripId, originalRoute: location.state.originalRoute } });
    } else {
      navigate('/view-route-details', { state: { selectedRoute: route } });
    }

  }

  const handleSaveRegeneratedRoute = async (originalRouteId, route) => {
          try {
              setIsSubmitting(true);
              await updateRoute(location.state.tripId, originalRouteId, route);
          } catch (err) {
              console.error('Error saving regenerated route:', err);
              setSubmitError('Could not save the selected route. Please try again.');
              return;
          } finally {
              setIsSubmitting(false);
          }
          navigate(`/view-trip-details/${location.state.tripId}`, { state: { fromRouteDetails: true } });
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

  const handleFilterChange = (filterKey, bound, value) => {
    if (value !== '' && Number(value) < 0) return

    setFilters((currentFilters) => ({
      ...currentFilters,
      [filterKey]: {
        ...currentFilters[filterKey],
        [bound]: value
      }
    }))
  }

  const clearFilter = (filterKey) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [filterKey]: {
        min: '',
        max: ''
      }
    }))
  }

  const hasActiveFilter = (filterKey) => filters[filterKey].min !== '' || filters[filterKey].max !== ''
  const filterConfigs = [
    {
      key: 'travelTime',
      label: 'Travel time',
      meta: 'Minutes',
      minPlaceholder: 'Min',
      maxPlaceholder: 'Max',
      helpText: 'Filter by travel time.'
    },
    {
      key: 'cost',
      label: 'Cost',
      meta: 'USD',
      minPlaceholder: 'Min',
      maxPlaceholder: 'Max',
      helpText: 'Filter by total cost.'
    },
    {
      key: 'distance',
      label: 'Distance',
      meta: 'Miles',
      minPlaceholder: 'Min',
      maxPlaceholder: 'Max',
      helpText: 'Filter by distance traveled.'
    },
    {
      key: 'stops',
      label: 'Stops',
      meta: 'Count',
      minPlaceholder: 'Min',
      maxPlaceholder: 'Max',
      helpText: 'Filter by number of stops.'
    }
  ]
  const activeFilterLabels = filterConfigs
    .filter((filter) => hasActiveFilter(filter.key))
    .map((filter) => filter.label.toLowerCase())
  const noMatchMessage = activeFilterLabels.length > 0
    ? `No routes match the selected ${activeFilterLabels.join(', ')} filter${activeFilterLabels.length > 1 ? 's' : ''}.`
    : 'No routes match the selected filters.'
  const [firstComparedRoute, secondComparedRoute] = comparisonRoutes
  const hasComparison = Boolean(firstComparedRoute || secondComparedRoute)

  const getComparisonSlot = (route) => comparisonRoutes.findIndex((selectedRoute) => selectedRoute === route)

  const handleCompareRoute = (route) => {
    setComparisonRoutes((currentRoutes) => {
      const [firstRoute, secondRoute] = currentRoutes

      if (firstRoute === route || secondRoute === route) {
        return currentRoutes
      }

      if (!firstRoute) return [route, null]
      if (!secondRoute) return [firstRoute, route]

      return [firstRoute, route]
    })
  }

  useEffect(() => {
    if (!firstComparedRoute || !secondComparedRoute || !comparisonPanelRef.current) return

    comparisonPanelRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }, [firstComparedRoute, secondComparedRoute])

  const clearComparison = () => {
    setComparisonRoutes([null, null])
  }

  const removeComparisonRoute = (slotIndex) => {
    setComparisonRoutes((currentRoutes) => {
      if (slotIndex === 0) {
        return [currentRoutes[1], null]
      }

      return [currentRoutes[0], null]
    })
  }

  const comparisonRows = [
    {
      label: 'Modes',
      getValue: (route) => getRouteModeSummary(route)
    },
    {
      label: 'Providers',
      getValue: (route) => getRouteProviderSummary(route)
    },
    {
      label: 'Departure',
      getValue: (route) => `${formatTime(route?.departAt)} • ${new Date(route?.departAt).toLocaleDateString()}`
    },
    {
      label: 'Arrival',
      getValue: (route) => `${formatTime(route?.arriveAt)} • ${new Date(route?.arriveAt).toLocaleDateString()}`
    },
    {
      label: 'Duration',
      getValue: (route) => formatDuration(route?.totalDuration || 0),
      getWinner: (firstRoute, secondRoute) => getComparisonWinner(firstRoute?.totalDuration, secondRoute?.totalDuration)
    },
    {
      label: 'Distance',
      getValue: (route) => `${route?.totalDistance ?? 0} miles`,
      getWinner: (firstRoute, secondRoute) => getComparisonWinner(firstRoute?.totalDistance, secondRoute?.totalDistance)
    },
    {
      label: 'Stops',
      getValue: (route) => {
        const stopCount = getRouteStopCount(route)
        return stopCount <= 0 ? 'Direct' : `${stopCount}`
      },
      getWinner: (firstRoute, secondRoute) => getComparisonWinner(getRouteStopCount(firstRoute), getRouteStopCount(secondRoute))
    },
    {
      label: 'Estimated cost',
      getValue: (route) => getRouteCostText(route),
      getWinner: (firstRoute, secondRoute) => getComparisonWinner(firstRoute?.totalCost, secondRoute?.totalCost)
    }
  ]

  const renderComparisonSlot = (route, slotIndex) => {
    if (!route) {
      return (
        <div className="route-comparison-slot route-comparison-slot-empty">
          <p className="route-comparison-slot-label">Route {slotIndex + 1}</p>
          <p className="route-comparison-empty-title">Select a route to compare</p>
          <p className="route-comparison-empty-copy">Click the Compare button on a route card below to add it here.</p>
        </div>
      )
    }

    return (
      <div className="route-comparison-slot">
        <div className="route-comparison-slot-top">
          <div>
            <p className="route-comparison-slot-label">Route {slotIndex + 1}</p>
            <h2>{getRouteModeSummary(route)}</h2>
            <p className="route-comparison-subtitle">{getRouteProviderSummary(route)}</p>
          </div>
          <button
            type="button"
            className="route-comparison-remove"
            onClick={() => removeComparisonRoute(slotIndex)}
          >
            Remove
          </button>
        </div>

        <div className="route-comparison-metrics">
          {comparisonRows.map((row) => {
            const winner = firstComparedRoute && secondComparedRoute && row.getWinner
              ? row.getWinner(firstComparedRoute, secondComparedRoute)
              : null
            const isWinner = (slotIndex === 0 && winner === 'first') || (slotIndex === 1 && winner === 'second')

            return (
              <div key={row.label} className="route-comparison-metric-row">
                <span className="route-comparison-metric-label">{row.label}</span>
                <span className={`route-comparison-metric-value${isWinner ? ' route-comparison-metric-value-winning' : ''}`}>
                  {row.getValue(route)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className="route-options-page">
      <header className="route-options-header">
        <div className="header-left">
          <h1>Route Suggestions</h1>
          <p>{originName.split(",").slice(0, 2).join(",")} to {destinationName.split(",").slice(0, 2).join(",")} on {departDate}</p>
          <p>MPG: {mpg}</p>
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
      
      {hasComparison && (
        <section ref={comparisonPanelRef} className="route-comparison-panel" aria-label="Route comparison">
          <div className="route-comparison-header">
            <div>
              <h2>Compare Routes</h2>
              <p>Review two route options side by side without leaving the page.</p>
            </div>
            <button type="button" className="route-comparison-clear" onClick={clearComparison}>
              Clear Comparison
            </button>
          </div>

          <div className="route-comparison-grid">
            {renderComparisonSlot(firstComparedRoute, 0)}
            {renderComparisonSlot(secondComparedRoute, 1)}
          </div>
        </section>
      )}

      <section className="route-options-controls" aria-label="Route filters">
        {filterConfigs.map((filter) => (
          <div key={filter.key} className="route-filter-group">
            <div className="route-filter-header">
              <label className="route-filter-label">{filter.label}</label>
              <span className="route-filter-meta">{filter.meta}</span>
            </div>
            <div className="route-filter-inputs">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder={filter.minPlaceholder}
                value={filters[filter.key].min}
                onChange={(event) => handleFilterChange(filter.key, 'min', event.target.value)}
                aria-label={`Minimum ${filter.label.toLowerCase()}`}
              />
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder={filter.maxPlaceholder}
                value={filters[filter.key].max}
                onChange={(event) => handleFilterChange(filter.key, 'max', event.target.value)}
                aria-label={`Maximum ${filter.label.toLowerCase()}`}
              />
            </div>
            <div className="route-filter-footer">
              <span className="route-filter-help">{filter.helpText}</span>
              <button
                type="button"
                className="route-filter-clear"
                onClick={() => clearFilter(filter.key)}
                disabled={!hasActiveFilter(filter.key)}
              >
                Clear
              </button>
            </div>
            {filterErrors[filter.key] && <p className="route-filter-error">{filterErrors[filter.key]}</p>}
          </div>
        ))}
      </section>

      {loading && <p>Loading route suggestions...</p>}
      {!loading && error && <p className="route-options-error">{error}</p>}
      {!loading && !error && routes.length === 0 && <p>No matching routes found.</p>}

      {/* Change to displayedRoutes when filtering/sorting is implemented */}
      {!loading && !error && routes.length > 0 && ( 
        <div className="route-options-layout">
          <aside className="provider-sidebar">
            <h3>Filter by Provider</h3>
              <div className="provider-checklist-scroll">
                  {Object.entries(providers).map(( [mode, providerList] ) => (
                    <div key={mode} className="provider-mode-group">
                      <h4 className="provider-mode-label">{mode}</h4>
                      {providerList.map((name) => (
                        <div key={name} className="checklist-item">
                          <input 
                            type="checkbox" 
                            checked={selectedProviders.includes(name)}
                            onChange={() => handleProviderToggle(name)} 
                            id={`provider-${name}`}
                          />
                          <label htmlFor={`provider-${name}`}>{name}</label>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
          </aside>
          {displayedRoutes.length == 0 ? (
            <div className="route-options-list">
               <p>No matching routes found.</p>
            </div>
          ) : (
            <main className="route-options-list">
              {displayedRoutes.map((route, index) => {
                console.log(`Rendering Route ${index + 1}:`, route);

              return (
                <li key={index} className="route-option-card">
                  {/* Left Column: Mode and Provider */}
                  <div className="route-main-info">
                    <h2>
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
                              ? `Estimated Cost: $${Number(route.totalCost).toFixed(2)}`
                              : "Fare Not Available"))}
                        </strong>
                      </p>
                    </div>

                  <button className="route-option-select-button" onClick={() => location.state?.isRegenerating ? handleSaveRegeneratedRoute(location.state.originalRoute._id, route) : handleAddRoute(route)}>
                    Add Route
                  </button>

                  <button
                    className={`route-option-compare-button${getComparisonSlot(route) !== -1 ? ' route-option-compare-button-active' : ''}`}
                    onClick={() => handleCompareRoute(route)}
                  >
                    {getComparisonSlot(route) === 0 ? 'Comparing: Route 1' : getComparisonSlot(route) === 1 ? 'Comparing: Route 2' : 'Compare'}
                  </button>

                    <button className="route-option-details-button" onClick={() => handleViewRoute(route)}>
                      View Route Details
                    </button>

                  </div>
                </li>
              );
            })}
          </main>
          )}
        </div>
      )}

      {!location.state?.isRegenerating && (
          <Link to="/create-route" className="route-options-back-link">
            Edit Route Search
          </Link>
        )
      }

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

            {modalStep === 'date-warning' && (
              <div className="route-modal-warning">
                <h3>WARNING ⚠️</h3>
                <p>This route departs on <strong>{new Date(routeToAdd.departAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}</strong>, 
                    which is outside the trip date range of <strong>{new Date(trips.find(t => t._id === pendingTripId)?.startDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</strong> to <strong>{new Date(trips.find(t => t._id === pendingTripId)?.endDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</strong>.
                    Do you want to accept and continue adding this route to the trip?</p>

                <div className="route-modal-actions">
                  <button
                    className="route-modal-primary"
                    onClick={() => executeAddRoute(pendingTripId)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Adding...' : 'Accept'}
                  </button>

                  <button
                    className="route-modal-secondary"
                    onClick={() => {
                      setModalStep('choose-trip');
                      setPendingTripId(null);
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}