import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSearchLocations } from '../../../services/routeServices'
import { getTodayDateString, validateCreateRouteInput } from '../routeUtils'
import './CreateRoute.css'

const LocationInput = ({
  id,
  label,
  value,
  onValueChange,
  suggestions,
  onSuggestionClick,
  error
}) => {
  return (
    <div className="create-route-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={`Type a ${label.toLowerCase()}`}
        autoComplete="off"
      />
      {error && <p className="create-route-error">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="create-route-suggestions">
          {suggestions.map((location) => (
            <li key={location.id}>
              <button type="button" onClick={() => onSuggestionClick(location)}>
                {location.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CreateRoute() {
  const navigate = useNavigate()
  const today = getTodayDateString()

  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [originSuggestions, setOriginSuggestions] = useState([])
  const [destinationSuggestions, setDestinationSuggestions] = useState([])

  const [departDate, setDepartDate] = useState('')
  const [errors, setErrors] = useState({})
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    const trimmed = originText.trim()
    let active = true

    if (origin && origin.name === trimmed) {
      setOriginSuggestions([])
      setRequestError('')
      return
    }

    if (trimmed.length < 2) {
      setOriginSuggestions([])
      setRequestError('')
      return
    }

    const timer = setTimeout(async () => {
      try {
        const suggestions = await getSearchLocations(trimmed)
        if (active) {
          setOriginSuggestions(suggestions)
          setRequestError('')
        }
      } catch {
        if (active) {
          setRequestError('Could not load location suggestions.')
        }
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      active = false
    }
  }, [originText, origin])

  useEffect(() => {
    const trimmed = destinationText.trim()
    let active = true

    if (destination && destination.name === trimmed) {
      setDestinationSuggestions([])
      setRequestError('')
      return
    }

    if (trimmed.length < 2) {
      setDestinationSuggestions([])
      setRequestError('')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const suggestions = await getSearchLocations(trimmed)
        if (active) {
          setDestinationSuggestions(suggestions)
          setRequestError('')
        }
      } catch {
        if (active) {
          setRequestError('Could not load location suggestions. Please try again.')
        }
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      active = false
    }
  }, [destinationText, destination])

  const handleOriginChange = (value) => {
    setOriginText(value)
    if (!origin || origin.name !== value) setOrigin(null)
  }

  const handleDestinationChange = (value) => {
    setDestinationText(value)
    if (!destination || destination.name !== value) setDestination(null)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setRequestError('')

    const nextErrors = validateCreateRouteInput({ origin, destination, departDate })

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})

    const query = new URLSearchParams({
      originId: origin.id,
      originName: origin.name,
      destinationId: destination.id,
      destinationName: destination.name,
      departDate
    })

    navigate(`/route-options?${query.toString()}`)
  }

  return (
    <section className="create-route-page">
      <h1>Create Route</h1>
      <p>Enter trip details to see route suggestions.</p>

      <form className="create-route-form" onSubmit={handleSubmit}>
        <LocationInput
          id="origin"
          label="Origin"
          value={originText}
          onValueChange={handleOriginChange}
          suggestions={originSuggestions}
          onSuggestionClick={(location) => {
            setOrigin(location)
            setOriginText(location.name)
            setOriginSuggestions([])
          }}
          error={errors.origin}
        />

        <LocationInput
          id="destination"
          label="Destination"
          value={destinationText}
          onValueChange={handleDestinationChange}
          suggestions={destinationSuggestions}
          onSuggestionClick={(location) => {
            setDestination(location)
            setDestinationText(location.name)
            setDestinationSuggestions([])
          }}
          error={errors.destination}
        />

        <div className="create-route-field">
          <label htmlFor="departDate">Departure Date</label>
          <input
            id="departDate"
            type="date"
            min={today}
            value={departDate}
            onChange={(event) => setDepartDate(event.target.value)}
          />
          {errors.departDate && <p className="create-route-error">{errors.departDate}</p>}
        </div>

        {requestError && <p className="create-route-error">{requestError}</p>}

        <button type="submit">See Route Suggestions</button>
      </form>
    </section>
  )
}
