import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTripById } from '../../services/tripServices';
import { deleteRoute } from '../../services/routeServices';

import './TripDetails.css';


export default function TripDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    // Delete route confirmation state
    const [showConfirm, setShowConfirm] = useState(false);
    const [routeToDelete, setRouteToDelete] = useState(null);

    useEffect(() => {
        const fetchTripDetails = async () => {
            try {
                const data = await getTripById(id);
                console.log("Fetched trip data:", data);
                setTrip(data);

            } catch (error) {
                console.error("Error fetching trip details:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchTripDetails();
    }, [id]);

    if (loading) {
        return (
            <div className="details-container">
                <p>Loading trip details...</p>
            </div>
        )
    }

    if (!trip) {
        return (
            <div className="details-container">
                <p>Trip not found.</p>
            </div>
        )
    }

    const calculateTotalCost = (routes) => {
        return routes.reduce((total, route) => total + (Number(route.totalCost) || 0), 0);
    };
    const currentTotal = trip.routes ? calculateTotalCost(trip.routes) : 0;

    const formatDate = (dateObj) => {
    const dateString = dateObj?.$date || dateObj; // check if the date is a nested $date object or a direct string
    if (!dateString) return 'MM/DD';
    
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

    const formatTime = (dateObj) => {
        const dateString = dateObj?.$date || dateObj;
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatShortUsLocation = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return 'Unknown';
        const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
        const hasUS = parts.some((p) =>
            /^(united states|united states of america|usa|us)$/i.test(p)
        );
        if (hasUS) {
            const city = parts[0] || 'Unknown';
            const state = parts[1] || '';
            return state ? `${city}, ${state}, USA` : `${city}, USA`;
        }
        if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
        return parts[0];
    };

    const getRouteTitle = (route) => {
        const from = formatShortUsLocation(route?.origin?.address || route?.origin?.name);
        const to = formatShortUsLocation(route?.destination?.address || route?.destination?.name);
        return `${from} to ${to}`;
    };

    const getRouteMetaLine = (route) => {
        const legs = Array.isArray(route?.legs) ? route.legs : [];
        if (legs.length === 0) return "No leg details";

        const modes = legs
            .map((leg) => leg?.transportationMode)
            .filter(Boolean)
            .map((mode) => {
                const lower = String(mode).toLowerCase();
                return lower.charAt(0).toUpperCase() + lower.slice(1);
            });

        const uniqueModes = modes.filter((mode, index) => index === 0 || mode !== modes[index - 1]);
        const modeText = uniqueModes.join(" → ");

        // start at -1 to not count first departure as stop
        let stopCount = -1;
        for (const leg of legs) {
            if (Array.isArray(leg?.segments) && leg.segments.length > 0) {
                stopCount += leg.segments.length;
            } else {
                stopCount += 1;
            }
        }

        const stopsText = stopCount <= 0
            ? "Direct"
            : `${stopCount} ${stopCount === 1 ? "Stop" : "Stops"}`;

        return `${modeText} • ${stopsText}`;
    };

    const getRouteTimeLine = (route) => {
        const start = formatTime(route?.departAt);
        const end = formatTime(route?.arriveAt);
        return `${start} to ${end}`;
    };

    return (
        <div className="details-container">
            <div className="top-nav">
                <button
                    className="back-button"
                    onClick={() => navigate('/my-trips')}
                >
                    ← Back
                </button>

                <button
                    className="edit-trip-button"
                    onClick={() => navigate(`/edit-trip/${id}`)}
                >
                    Edit Trip Details
                </button>
            </div>
            
            <div className="details-header">
                <div className="header-main">
                    <h1>{trip.name}</h1>
                </div>
                
                <div className="header-stats">
                    <p className="trip-desc">{trip.description}</p>
                    <div className="trip-dates"><strong>Dates: </strong>{new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}</div>
                    <div className="trip-budget"><strong>Budget:</strong> ${trip.budget?.toFixed(2) || 'N/A'}</div>
                    <div className={`trip-cost ${currentTotal > trip.budget ? 'over-budget' : ''}`}>
                        <strong>Total Cost:</strong> ${currentTotal?.toFixed(2) || 'N/A'} {/* using currentTotal for live updates, but can use trip.totalCost instead */}
                    </div>
                </div>
            </div>

            <div className="details-content">
                <h2>Routes</h2>
                {trip.routes && trip.routes.length > 0 ? (
                    <div className="routes-list">
                        {trip.routes.map((route, index) => (
                            <div key={index} className="route-row">
                                {/* date circle on the left */}
                                <div className="route-date-circle">
                                    {formatDate(route.departAt)}
                                </div>

                                {/* route card on the right */}
                                <div className="route-card">
                                    <div className="route-info">
                                        <h3>{getRouteTitle(route)}</h3>
                                        <p>{getRouteMetaLine(route)}</p>
                                        <p>{getRouteTimeLine(route)}</p>
                                    </div>

                                    <div className="route-actions">
                                        <button
                                            className="view-details-button"
                                            onClick={() =>
                                                navigate('/view-route-details', {
                                                    state: {
                                                        selectedRoute: route,
                                                        fromTripDetails: true,
                                                        tripId: trip._id
                                                    }
                                                })
                                            }
                                        >
                                            View Details
                                        </button>

                                        <button
                                            className="delete-route-button"
                                            onClick={async () => {
                                                setRouteToDelete(route);
                                                setShowConfirm(true);
                                            }}
                                        >
                                            Delete Route
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No routes added to this trip yet.</p>
                )}
            </div>
            
            {/* Delete Route Confirmation Popup */}
            {showConfirm && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }} >
                <div style={{ background: "white", padding: "20px", borderRadius: "8px", width: "300px", textAlign: "center" }} >
                    <h3>Confirm Delete</h3>
                    <p>Delete “{routeToDelete?.name}”?</p>

                    <button style={{ background: "#e63946", color: "white", padding: "10px", border: "none", borderRadius: "6px", marginRight: "10px", cursor: "pointer" }} onClick={async () => {
                        await deleteRoute(trip._id, routeToDelete._id);
                        const updatedTrip = await getTripById(trip._id);
                        setTrip(updatedTrip);
                        setShowConfirm(false);
                    }}
                    >
                    Confirm
                    </button>

                    <button style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer" }} onClick={() => setShowConfirm(false)}
                    >
                    Cancel
                    </button>
                </div>
                </div>
            )}
        </div>
    )
}