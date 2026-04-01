import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getTripById } from '../../services/tripServices';
import { deleteRoute } from '../../services/routeServices';
import { sendTripInvitation, listTripInvitations } from '../../services/invitationServices';
import { useUser } from '../../../context/useUser';

import './TripDetails.css';

function mongoIdString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.$oid) return value.$oid;
    return String(value);
}


export default function TripDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { dbUser } = useUser();
    const location = useLocation();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    // Delete route confirmation state
    const [showConfirm, setShowConfirm] = useState(false);
    const [routeToDelete, setRouteToDelete] = useState(null);

    // Invite collaborators (owner only)
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteFeedback, setInviteFeedback] = useState(null);
    const [tripInvitations, setTripInvitations] = useState([]);
    const [inviteLoadError, setInviteLoadError] = useState(null);

    useEffect(() => {
        const fetchTripDetails = async () => {
            if (!dbUser?._id) {
                setLoading(false);
                return;
            }
            try {
                const data = await getTripById(id, dbUser._id);
                console.log("Fetched trip data:", data);
                setTrip(data);

            } catch (error) {
                console.error("Error fetching trip details:", error);
                setTrip(null);
            } finally {
                setLoading(false);
            }
        }

        fetchTripDetails();
    }, [id, dbUser?._id]);

    useEffect(() => {
        if (!trip || !dbUser?._id) return;
        const owner = mongoIdString(trip.owner) === mongoIdString(dbUser._id);
        if (!owner) {
            setTripInvitations([]);
            setInviteLoadError(null);
            return;
        }
        const tid = id || mongoIdString(trip._id);
        let cancelled = false;
        (async () => {
            try {
                setInviteLoadError(null);
                const list = await listTripInvitations(tid, dbUser._id);
                if (!cancelled) setTripInvitations(Array.isArray(list) ? list : []);
            } catch (e) {
                console.error('Error loading trip invitations:', e);
                if (!cancelled) {
                    setTripInvitations([]);
                    setInviteLoadError(
                        e?.response?.data?.error || 'Could not load invitation activity.'
                    );
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [trip, dbUser?._id, id]);

    useEffect(() => {
        if (location.state?.fromRouteDetails) {
            // If coming back from route details, refresh trip data to get any updates
            const refreshTrip = async () => {
                try {
                    const data = await getTripById(id);
                    setTrip(data);
                } catch (error) {
                    console.error("Error refreshing trip details:", error);
                }
            }
            refreshTrip();
        }
    }, [location.state?.fromRouteDetails, id]);

    if (loading) {
        return (
            <div className="details-container">
                <p>Loading trip details...</p>
            </div>
        )
    }

    if (!dbUser?._id) {
        return (
            <div className="details-container">
                <p>Sign in to view this trip.</p>
            </div>
        );
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

    const sortedRoutes = trip.routes ? [...trip.routes].sort((a, b) => {
        const dateA = new Date(a.departAt?.$date || a.departAt);
        const dateB = new Date(b.departAt?.$date || b.departAt);
        return dateA - dateB;
    }) : [];

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

    const tripIdStr = mongoIdString(trip._id);
    const isTripOwner = mongoIdString(trip.owner) === mongoIdString(dbUser?._id);

    const invitationActivityText = (inv) => {
        const email = inv.inviteeEmail || 'Unknown';
        const when = new Date(inv.updatedAt || inv.createdAt).toLocaleString();
        switch (inv.status) {
            case 'pending':
                return `Invitation sent to ${email} — ${when}`;
            case 'accepted':
                return `${email} accepted the invitation — ${when}`;
            case 'declined':
                return `${email} declined the invitation — ${when}`;
            case 'revoked':
                return `Invitation to ${email} was revoked — ${when}`;
            default:
                return `${email} — ${inv.status} — ${when}`;
        }
    };

    const handleSendInvite = async (e) => {
        e.preventDefault();
        setInviteFeedback(null);
        const email = inviteEmail.trim();
        if (!email) {
            setInviteFeedback({ type: 'error', text: 'Enter an email address.' });
            return;
        }
        setInviteSending(true);
        try {
            const apiTripId = id || tripIdStr;
            await sendTripInvitation(apiTripId, email, dbUser._id);
            setInviteEmail('');
            setInviteLoadError(null);
            const list = await listTripInvitations(apiTripId, dbUser._id);
            setTripInvitations(Array.isArray(list) ? list : []);
        } catch (err) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                'Could not send the invitation. Please try again.';
            setInviteFeedback({ type: 'error', text: msg });
        } finally {
            setInviteSending(false);
        }
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

                {isTripOwner && (
                    <button
                        className="edit-trip-button"
                        onClick={() => navigate(`/edit-trip/${id}`)}
                    >
                        Edit Trip Details
                    </button>
                )}
            </div>
            
            <div className="details-header">
                <div className="header-main">
                    <h1>{trip.name}</h1>
                </div>
                
                <div className="header-stats">
                    <p className="trip-desc">{trip.description}</p>
                    <div className="trip-dates"><strong>Dates: </strong>{new Date(trip.startDate).toLocaleDateString('en-US', {timeZone: 'UTC'})} - {new Date(trip.endDate).toLocaleDateString('en-US', {timeZone: 'UTC'})}</div>
                    <div className="trip-budget"><strong>Budget:</strong> ${trip.budget?.toFixed(2) || 'N/A'}</div>
                    <div className={`trip-cost ${currentTotal > trip.budget ? 'over-budget' : ''}`}>
                        <strong>Total Cost:</strong> ${currentTotal?.toFixed(2) || 'N/A'} {/* using currentTotal for live updates, but can use trip.totalCost instead */}
                    </div>
                </div>
            </div>

            {isTripOwner && (
                <section className="invite-collaborators" aria-labelledby="invite-collaborators-heading">
                    <h2 id="invite-collaborators-heading">Invite collaborators</h2>
                    <form className="invite-collaborators-form" onSubmit={handleSendInvite}>
                        <label htmlFor="collaborator-email" className="visually-hidden">
                            Collaborator email
                        </label>
                        <input
                            id="collaborator-email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder="name@example.com"
                            value={inviteEmail}
                            onChange={(e) => {
                                setInviteEmail(e.target.value);
                                if (inviteFeedback) setInviteFeedback(null);
                            }}
                            disabled={inviteSending}
                            className="invite-collaborators-input"
                        />
                        <button
                            type="submit"
                            className="invite-collaborators-submit"
                            disabled={inviteSending}
                        >
                            {inviteSending ? 'Sending…' : 'Send invitation'}
                        </button>
                    </form>
                    {inviteFeedback?.type === 'error' && (
                        <p className="invite-collaborators-message invite-collaborators-message--error" role="alert">
                            {inviteFeedback.text}
                        </p>
                    )}

                    <details className="invite-activity-details" defaultOpen>
                        <summary className="invite-activity-summary">
                            Invitation activity
                            {tripInvitations.length > 0 ? (
                                <span className="invite-activity-count">({tripInvitations.length})</span>
                            ) : null}
                        </summary>
                        <div className="invite-activity-body">
                            {inviteLoadError && (
                                <p className="invite-collaborators-message invite-collaborators-message--error" role="alert">
                                    {inviteLoadError}
                                </p>
                            )}
                            {!inviteLoadError && tripInvitations.length === 0 ? (
                                <p className="invite-activity-empty">No invitation activity yet.</p>
                            ) : null}
                            {!inviteLoadError && tripInvitations.length > 0 ? (
                                <ul className="invite-activity-list">
                                    {tripInvitations.map((inv) => (
                                        <li key={mongoIdString(inv._id)} className="invite-activity-item">
                                            {invitationActivityText(inv)}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    </details>
                </section>
            )}

            <div className="details-content">
                <h2>Routes</h2>
                {sortedRoutes && sortedRoutes.length > 0 ? (
                    <div className="routes-list">
                        <div className="routes-list">
                            {sortedRoutes.map((route, index) => {
                                const currentDate = formatDate(route.departAt);
                                const previousDate = index > 0 ? formatDate(sortedRoutes[index - 1].departAt) : null;
                                const isSameDay = currentDate === previousDate;

                                return (
                                    <div key={index} className={`route-row ${isSameDay ? 'same-day' : ''}`}>
                                        <div className="route-date-circle">
                                            {!isSameDay ? currentDate : ""}
                                        </div>

                                        <div className="route-card">
                                            <div className="route-info">
                                                <h3>{getRouteTitle(route)}</h3>
                                                <p>{getRouteMetaLine(route)}</p>
                                                <p>{getRouteTimeLine(route)}</p>
                                            </div>

                                            <div className="route-actions">
                                                <button
                                                    className="view-details-button"
                                                    onClick={() => navigate('/view-route-details', { 
                                                        state: { selectedRoute: route, fromTripDetails: true, tripId: trip._id } 
                                                    })}
                                                >
                                                    View Details
                                                </button>

                                                {isTripOwner && (
                                                    <button
                                                        className="delete-route-button"
                                                        onClick={() => {
                                                            setRouteToDelete(route);
                                                            setShowConfirm(true);
                                                        }}
                                                    >
                                                        Delete Route
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <p>No routes added to this trip yet.</p>
                )}
            </div>
            
            {/* Delete Route Confirmation Popup */}
            {showConfirm && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }} >
                <div style={{ background: "white", padding: "20px", borderRadius: "8px", width: "300px", textAlign: "center", zIndex: 1000 }} >
                    <h3>Confirm Delete</h3>
                    <p>Delete “{routeToDelete?.name}”?</p>

                    <button style={{ background: "#e63946", color: "white", padding: "10px", border: "none", borderRadius: "6px", marginRight: "10px", cursor: "pointer" }} onClick={async () => {
                        const tripId = typeof trip._id === 'string' ? trip._id : trip._id?.$oid ?? String(trip._id);
                        await deleteRoute(tripId, routeToDelete._id, dbUser._id);
                        const updatedTrip = await getTripById(tripId, dbUser._id);
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