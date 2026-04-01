import { useLocation, useNavigate, Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { addRoute, regenerateRoute, updateRoute } from '../../../services/routeServices';
import { getTrips } from '../../../services/tripServices';
import { useUser } from '../../../../context/useUser';

import './RouteDetails.css';

export default function RouteDetails() {
    const location = useLocation();
    const navigate = useNavigate();
    const { dbUser } = useUser();
    const [showAddRouteModal, setShowAddRouteModal] = useState(false);
    const [modalStep, setModalStep] = useState('choose-action');
    const [trips, setTrips] = useState([]);
    const [loadingTrips, setLoadingTrips] = useState(false);
    const [tripsError, setTripsError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedLegs, setSelectedLegs] = useState([]);
    const [isSubmittingRegeneration, setIsSubmittingRegeneration] = useState(false);

    const route = location.state?.selectedRoute;
    const fromTripDetails = Boolean(location.state?.fromTripDetails);
    const tripIdFromState = location.state?.tripId;
    const fromRegeneration = Boolean(location.state?.fromRegeneration);

    useEffect(() => {
        if (!showAddRouteModal || modalStep !== 'choose-trip') return;
        if (!dbUser?._id) {
            setTrips([]);
            setTripsError('Your profile is still loading. Please try again.');
            return;
        }

        let cancelled = false;
        const loadTrips = async () => {
            setLoadingTrips(true);
            setTripsError('');
            try {
                const data = await getTrips(dbUser._id);
                if (!cancelled) {
                    setTrips(data || []);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error loading trips:', err);
                    setTripsError('Could not load your trips right now. Please try again.');
                }
            } finally {
                if (!cancelled) setLoadingTrips(false);
            }
        };

        loadTrips();

        return () => {
            cancelled = true;
        };
    }, [showAddRouteModal, modalStep, dbUser?._id]);

    const locationFromName = (locationData = {}, fallback = 'Unknown') => {
        const rawAddress = locationData?.address || locationData?.name || fallback;
        const parts = String(rawAddress).split(',').map((p) => p.trim()).filter(Boolean);
        const hasUS = parts.some((p) => /^(united states|united states of america|usa|us)$/i.test(p));
        let shortName = parts[0] || fallback;
        if (hasUS) {
            shortName = parts[1] ? `${parts[0]}, ${parts[1]}, USA` : `${parts[0]}, USA`;
        } else if (parts.length >= 2) {
            shortName = `${parts[0]}, ${parts[1]}`;
        }

        return {
            ...locationData,
            name: shortName,
            address: rawAddress
        };
    };

    const routePayload = () => ({
        name: `${locationFromName(route.origin, 'Route Origin').name} to ${locationFromName(route.destination, 'Route Destination').name}`,
        origin: locationFromName(route.origin, 'Route Origin'),
        destination: locationFromName(route.destination, 'Route Destination'),
        departAt: route.departAt,
        arriveAt: route.arriveAt,
        totalDuration: Number(route.totalDuration),
        totalDistance: Number(route.totalDistance),
        totalCost: route.totalCost !== undefined && route.totalCost !== null ? Number(route.totalCost) : null,
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
    });

    const closeModal = () => {
        if (isSubmitting) return;
        setShowAddRouteModal(false);
        setModalStep('choose-action');
        setTripsError('');
        setSubmitError('');
    };

    const handleAddToTrip = async (tripId) => {
        setIsSubmitting(true);
        setSubmitError('');
        try {
            await addRoute(tripId, routePayload(), dbUser._id);
            closeModal();
            navigate(`/view-trip-details/${tripId}`);
        } catch (err) {
            console.error('Error adding route to trip:', err);
            setSubmitError(err?.response?.data?.error || 'Could not add route. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateNewTrip = () => {
        closeModal();
        navigate('/create-trip', { state: { pendingRoute: route } });
    };

    const handleSaveRegeneratedRoute = async (route) => {
        try {
            setIsSubmitting(true);
            await updateRoute(location.state.tripId, location.state.originalRoute?._id, route);
        } catch (err) {
            console.error('Error saving regenerated route:', err);
            setSubmitError('Could not save the selected route. Please try again.');
            return;
        } finally {
            setIsSubmitting(false);
        }
        navigate(`/view-trip-details/${location.state.tripId}`, { state: { fromRouteDetails: true } });
    }

    const formatTime = (isoString) => {
        if (!isoString) return "N/A";
        return new Date(isoString).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getTimeDate = (isoString) => {
        if (!isoString) return "N/A";
        return isoString.split('T')[0].substring(5, 10).split('-').join('/');
    }

    const formatDuration = (totalMinutes) => {
        if (!totalMinutes || totalMinutes <= 0) return "0 min";
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        const hoursPart = hours > 0 ? `${hours}h ` : "";
        const minutesPart = minutes > 0 ? `${minutes}m` : "";
        
        return (hoursPart + minutesPart).trim();
    };

    const layoverTime = (segment1, segment2) => {
        if (!segment1 || !segment2) return 0;

        const arrivalTime1 = new Date(segment1.arriveAt);
        const departureTime2 = new Date(segment2.departAt);

        const layoverMinutes = (departureTime2 - arrivalTime1) / (1000 * 60);
        return layoverMinutes > 0 ? layoverMinutes.toFixed(0) : 0;
    }

    const toggleLegSelection = (legIndex) => {
        setSelectedLegs((prevSelected) => {
            if (prevSelected.includes(legIndex)) {
                return prevSelected.filter((index) => index !== legIndex);
            } else {
                return [...prevSelected, legIndex];
            }
        });
    };

    const handleRegenerateRoute = async (route) => {
        try {
            setIsSubmittingRegeneration(true);
            const newRoutes = await regenerateRoute(route, selectedLegs);
            navigate('/route-options', { 
                state: { 
                        isRegenerating: true,
                        tripId: fromTripDetails ? tripIdFromState : null,                       
                        originalRoute: route, 
                        regeneratedRoutes: newRoutes
                    } });
        } catch (err) {
            console.error("Error regenerating route:", err);
            alert('Could not regenerate route. Please try again.');
        } finally {
            setIsSubmittingRegeneration(false);
        }
    };


    if (!route) {
        return <p>No route selected. Please <Link to="/create-route">search again</Link>.</p>
    }

    return (
        <div className="route-details-page">
            { isSubmittingRegeneration && (
                <div className="regeneration-overlay">
                    <div className="spinner"></div>
                    <p>Regenerating route...</p>
                </div>
            )

            }
            <div className="route-details-header">
                <h2>Itinerary: {route.name}</h2>
                
                {fromTripDetails && (
                    <button
                        className="edit-route-button"
                        onClick={() => setIsEditing((prev) => !prev)}
                        disabled={route.legs.length === 0}
                    >
                        {isEditing ? 'Cancel Edit' : 'Edit Route'}
                    </button>
                )}
            </div>

            <div className="route-summary-banner">
                <div className="summary-stat">
                    <strong>Total Travel Time:</strong>
                    <span>{formatTime(route.departAt) } - {formatTime(route.arriveAt)}</span>
                </div>
                <div className="summary-stat">
                    <strong>Total Duration: </strong>
                    <span>{formatDuration(route.totalDuration)}</span>
                </div>
                <div className="summary-stat">
                    <strong>Total Cost: </strong>
                    <span>{route.totalCost > 0 ? `$${route.totalCost}` : "Unknown"}</span>
                </div>
                <div className="summary-stat">
                    <strong>Total Distance: </strong>
                    <span>{route.totalDistance || 0} miles</span>
                </div>
            </div>

            <div className="route-details-legs">
                {route.legs.map((leg, index) => (
                    <div key = {index} className={`leg-edit-wrapper`}>
                        {isEditing && (
                            <div className="leg-checkbox-container">
                                <input
                                    type="checkbox"
                                    checked={selectedLegs.includes(index)}
                                    onChange={() => toggleLegSelection(index)}
                                />
                            </div>
                        )}

                        <div key={index} className="leg-detail-card">
                            <div className="leg-header">
                                <h3>Leg {index + 1}: {leg.transportationMode}</h3>
                                <span>Provider: </span> {(() => {
                                    const providers = Array.isArray(leg.provider)
                                    ? leg.provider
                                    : (leg.provider ? [leg.provider] : []);
                                    return providers.length > 0 ? providers.join(" → ") : "N/A";
                                })()}
                            </div>

                            <div className="leg-path-visual">
                                {leg.segments && leg.segments.length > 0 ? (
                                    // MULTI-SEGMENT
                                    leg.segments.map((seg, index) => {
                                        const prevSegment = index > 0 ? leg.segments[index - 1] : null;
                                        const transferMinutes = prevSegment ? layoverTime(prevSegment, seg) : null;
                                        return (
                                            <React.Fragment key={`seg-node-${index}`}>
                                                <div className="path-node">
                                                    {/* If this is a transfer segment (not the first segment and has a layover), show transfer label and both times */}
                                                    {transferMinutes !== null && (
                                                        <>
                                                            <span className="transfer-label">
                                                                {formatDuration(transferMinutes)} transfer
                                                            </span>
                                                            <span className="transfer-time">{formatTime(seg.arriveAt)} / {formatTime(seg.departAt)}</span>
                                                            <span className="path-address">{seg.origin.name}</span>
                                                        </>
                                                    )}
                                                    {transferMinutes === null && (
                                                        <>
                                                            <span className="path-time">{formatTime(seg.departAt)}</span>
                                                            <span className="path-address">{seg.origin.name}</span>
                                                        </>
                                                    )}
                                                </div>

                                            <div className="path-connector">
                                                <span className="path-duration">{formatDuration(seg.duration)}</span>
                                                <div className="connector-line"></div>
                                            </div>

                                            {index === leg.segments.length - 1 && (
                                                <div className="path-node">
                                                    <span className="path-time">{formatTime(seg.arriveAt)}</span>
                                                    <span className="path-address">{seg.destination.name}</span>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    )})
                                ) : (
                                    // FALLBACK: SINGLE LEG (No Segments)
                                    <>
                                        <div className="path-node">
                                            <span className="path-date">{getTimeDate(leg.departAt)}</span>
                                            <span className="path-time">{formatTime(leg.departAt)}</span>
                                            <span className="path-address">{leg.origin.name}</span>
                                        </div>

                                        <div className="path-connector">
                                            <span className="path-duration">{formatDuration(leg.duration)}</span>
                                            <div className="connector-line"></div>
                                            <span className="path-distance">{leg.distance} mi</span>
                                        </div>

                                        <div className="path-node">
                                            <span className = "path-date">{getTimeDate(leg.arriveAt)}</span>
                                            <span className="path-time">{formatTime(leg.arriveAt)}</span>
                                            <span className="path-address">{leg.destination.name}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className='leg-cost'> Cost: {leg.cost ? `$${leg.cost}` : 'Unknown'} </div>
                            <div className='leg-distance'> Distance: {leg.distance} mi </div>
                            <div className='leg-duration'> Duration: {formatDuration(leg.duration)} </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="route-details-footer">
                <button
                    className="back-button"
                    onClick={() => {
                        if (fromTripDetails) {
                            navigate(tripIdFromState ? `/view-trip-details/${tripIdFromState}` : '/my-trips');
                            return;
                        }
                        navigate(-1);
                    }}
                >
                    {fromTripDetails ? '← Back to Trip' : '← Back to Suggestions'}
                </button>
                {isEditing ? (
                    <button
                        className="regenerate-button"
                        onClick={() => handleRegenerateRoute(route, selectedLegs)}
                        disabled={selectedLegs.length === 0}
                    >
                        Regenerate Selected Legs
                    </button>
                ) : ( !fromTripDetails && (
                    <button
                        className="add-route-button"
                        onClick={() => {
                            if (fromRegeneration) {
                                handleSaveRegeneratedRoute(route);
                                navigate(`/view-trip-details/${location.state.tripId}`);
                                return;
                            }
                            setShowAddRouteModal(true);
                            setModalStep('choose-action');
                            setTripsError('');
                            setSubmitError('');
                        }}
                    >
                        {fromRegeneration ? "Select Route" : "Add Route"}
                    </button>
                    )
                )}
            </div>

            {showAddRouteModal && (
                <div className="route-modal-overlay" onClick={closeModal}>
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
                                    <button className="route-modal-secondary" onClick={closeModal}>
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
                                        if (isSubmitting) return;
                                        setModalStep('choose-action');
                                        setSubmitError('');
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
                                                    onClick={() => handleAddToTrip(trip._id)}
                                                    disabled={isSubmitting}
                                                >
                                                    <span>{trip.name}</span>
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
                                    <button className="route-modal-secondary" onClick={closeModal} disabled={isSubmitting}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

