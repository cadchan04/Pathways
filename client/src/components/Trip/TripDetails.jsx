import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getTripById } from '../../services/tripServices';
import { deleteRoute } from '../../services/routeServices';
import { sendTripInvitation, listTripInvitations } from '../../services/invitationServices';
import { getRoutePreferences, saveMyRoutePreference } from '../../services/routePreferenceServices';
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
    const location = useLocation();
    const { dbUser } = useUser();
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
    const [isLoadingPreferenceData, setIsLoadingPreferenceData] = useState(false);
    const [isSavingPreference, setIsSavingPreference] = useState(false);
    const [preferenceError, setPreferenceError] = useState('');
    const [groupSummary, setGroupSummary] = useState(null);
    const [showPreferencesModal, setShowPreferencesModal] = useState(false);
    const TRANSPORT_MODES = ['RIDESHARE', 'PERSONAL_VEHICLE', 'BUS', 'TRAIN', 'FLIGHT'];
    const [rankByMode, setRankByMode] = useState({
        RIDESHARE: '',
        PERSONAL_VEHICLE: '',
        BUS: '',
        TRAIN: '',
        FLIGHT: '',
    });

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
        if (!trip || !dbUser?._id) return;

        const hasCollaborators = Array.isArray(trip?.collaboratorIds) && trip.collaboratorIds.length > 0;
        if (!hasCollaborators) {
            setGroupSummary(null);
            setPreferenceError('');
            setRankByMode({
                RIDESHARE: '',
                PERSONAL_VEHICLE: '',
                BUS: '',
                TRAIN: '',
                FLIGHT: '',
            });
            return;
        }

        let cancelled = false;
        (async () => {
            setIsLoadingPreferenceData(true);
            setPreferenceError('');
            try {
                const tripId = id || mongoIdString(trip._id);
                const uid = mongoIdString(dbUser._id);
                const prefData = await getRoutePreferences(tripId, uid);
                if (!cancelled) {
                    setGroupSummary(prefData?.groupSummary || null);
                    if (prefData?.myPreference?.rankByMode) {
                        setRankByMode(normalizeRankByMode(prefData.myPreference.rankByMode));
                    } else if (prefData?.myPreference?.ranking) {
                        const normalized = normalizeRanking(prefData.myPreference.ranking);
                        setRankByMode(buildRankByModeFromRanking(normalized));
                    } else {
                        setRankByMode({
                            RIDESHARE: '',
                            PERSONAL_VEHICLE: '',
                            BUS: '',
                            TRAIN: '',
                            FLIGHT: '',
                        });
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error loading route preferences:', err);
                    setPreferenceError(err?.response?.data?.error || 'Could not load route preferences.');
                }
            } finally {
                if (!cancelled) setIsLoadingPreferenceData(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [trip, id, dbUser?._id]);

    useEffect(() => {
        if (!trip || !dbUser?._id) return;
        const hasCollaborators = Array.isArray(trip?.collaboratorIds) && trip.collaboratorIds.length > 0;
        if (!hasCollaborators) return;

        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            const tripId = id || mongoIdString(trip._id);
            getRoutePreferences(tripId, mongoIdString(dbUser._id))
                .then((prefData) => {
                    setGroupSummary(prefData?.groupSummary || null);
                })
                .catch(() => {});
        };

        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [trip, id, dbUser?._id]);

    useEffect(() => {
        if (!showPreferencesModal || !trip || !dbUser?._id) return;
        const hc = Array.isArray(trip?.collaboratorIds) && trip.collaboratorIds.length > 0;
        if (!hc) return;
        let cancelled = false;
        (async () => {
            try {
                const tripId = id || mongoIdString(trip._id);
                const uid = mongoIdString(dbUser._id);
                const prefData = await getRoutePreferences(tripId, uid);
                if (cancelled) return;
                setGroupSummary(prefData?.groupSummary || null);
            } catch (err) {
                console.error('Error loading route preferences (modal):', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showPreferencesModal, trip, id, dbUser?._id]);

    useEffect(() => {
        if (!location.state?.fromRouteDetails || !id || !dbUser?._id) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await getTripById(id, mongoIdString(dbUser._id));
                if (!cancelled) setTrip(data);
            } catch (error) {
                console.error('Error refreshing trip details:', error);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [location.state?.fromRouteDetails, id, dbUser?._id]);

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

    const hasCollaborators = Array.isArray(trip?.collaboratorIds) && trip.collaboratorIds.length > 0;

    const modeLabel = (mode) => {
        const labels = {
            RIDESHARE: 'Rideshare',
            PERSONAL_VEHICLE: 'Personal Vehicle',
            BUS: 'Bus',
            TRAIN: 'Train',
            FLIGHT: 'Flight',
        };
        return labels[mode] || mode;
    };

    const normalizeRanking = (ranking = []) => {
        const cleaned = ranking.map((m) => String(m || '').trim().toUpperCase());
        const uniqueValid = cleaned.filter(
            (m, idx) => TRANSPORT_MODES.includes(m) && cleaned.indexOf(m) === idx
        );
        return uniqueValid;
    };

    const buildRankByModeFromRanking = (ranking) => ({
        RIDESHARE: ranking.includes('RIDESHARE') ? ranking.indexOf('RIDESHARE') + 1 : '',
        PERSONAL_VEHICLE: ranking.includes('PERSONAL_VEHICLE') ? ranking.indexOf('PERSONAL_VEHICLE') + 1 : '',
        BUS: ranking.includes('BUS') ? ranking.indexOf('BUS') + 1 : '',
        TRAIN: ranking.includes('TRAIN') ? ranking.indexOf('TRAIN') + 1 : '',
        FLIGHT: ranking.includes('FLIGHT') ? ranking.indexOf('FLIGHT') + 1 : '',
    });

    const normalizeRankByMode = (raw = {}) => {
        const normalized = {};
        for (const mode of TRANSPORT_MODES) {
            const value = raw?.[mode];
            if (value === '' || value == null) {
                normalized[mode] = '';
                continue;
            }
            const n = Number(value);
            normalized[mode] = Number.isInteger(n) && n >= 1 && n <= 5 ? n : '';
        }
        return normalized;
    };

    const handleRankSelectChange = (mode, value) => {
        if (value === '') {
            setRankByMode((prev) => ({ ...prev, [mode]: '' }));
            return;
        }
        const nextRank = Number(value);
        if (!Number.isInteger(nextRank) || nextRank < 1 || nextRank > 5) return;
        setRankByMode((prev) => ({ ...prev, [mode]: nextRank }));
    };

    const handleSavePreferences = async () => {
        if (!hasCollaborators || !dbUser?._id) return;
        setIsSavingPreference(true);
        setPreferenceError('');
        try {
            const tripId = id || tripIdStr;
            const uid = mongoIdString(dbUser._id);
            await saveMyRoutePreference(tripId, rankByMode, uid);
            const latest = await getRoutePreferences(tripId, uid);
            setGroupSummary(latest.groupSummary || null);
            if (latest?.myPreference?.rankByMode) {
                setRankByMode(normalizeRankByMode(latest.myPreference.rankByMode));
            } else if (latest?.myPreference?.ranking) {
                const normalized = normalizeRanking(latest.myPreference.ranking);
                setRankByMode(buildRankByModeFromRanking(normalized));
            } else {
                setRankByMode({
                    RIDESHARE: '',
                    PERSONAL_VEHICLE: '',
                    BUS: '',
                    TRAIN: '',
                    FLIGHT: '',
                });
            }
        } catch (err) {
            console.error('Error saving route preferences:', err);
            setPreferenceError(err?.response?.data?.error || 'Could not save preferences right now.');
        } finally {
            setIsSavingPreference(false);
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

    const buildGroupSummaryModel = (summary) => {
        if (!summary || summary.submissionsCount <= 0) return null;
        const responseCount = summary.submissionsCount;
        const avgForMode = (mode) => (summary.scores[mode] ?? 0) / responseCount;
        const avgScores = TRANSPORT_MODES.map((m) => avgForMode(m));
        const minAvg = Math.min(...avgScores);
        const maxAvg = Math.max(...avgScores);
        return {
            responseCount,
            avgForMode,
            maxAvg,
            avgSpan: maxAvg - minAvg,
        };
    };

    const renderGroupSummaryBars = (summary, model) => (
        <div className="group-transport-bars" role="list">
            {[...TRANSPORT_MODES]
                .sort((a, b) => {
                    const da = model.avgForMode(a);
                    const db = model.avgForMode(b);
                    if (da !== db) return da - db;
                    return modeLabel(a).localeCompare(modeLabel(b));
                })
                .map((mode) => {
                    const avg = model.avgForMode(mode);
                    const pct =
                        model.avgSpan === 0 ? 100 : Math.round((100 * (model.maxAvg - avg)) / model.avgSpan);
                    const isTopPick = (summary.tiedModes || []).includes(mode);
                    return (
                        <div key={mode} className="group-transport-bar-row" role="listitem">
                            <span className="group-transport-bar-label">{modeLabel(mode)}</span>
                            <div className="group-transport-bar-track" aria-hidden="true">
                                <div
                                    className={
                                        isTopPick
                                            ? 'group-transport-bar-fill group-transport-bar-fill--top'
                                            : 'group-transport-bar-fill'
                                    }
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
        </div>
    );

    const renderGroupSummaryEmptyBars = () => (
        <div className="group-transport-bars group-transport-bars--empty" role="list">
            {TRANSPORT_MODES.map((mode) => (
                <div key={mode} className="group-transport-bar-row" role="listitem">
                    <span className="group-transport-bar-label">{modeLabel(mode)}</span>
                    <div className="group-transport-bar-track" aria-hidden="true">
                        <div
                            className="group-transport-bar-fill group-transport-bar-fill--empty"
                            style={{ width: '0%' }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );

    const renderModalGroupSummary = () => {
        if (!hasCollaborators) return null;
        const model = groupSummary ? buildGroupSummaryModel(groupSummary) : null;
        const tied = groupSummary?.tiedModes || [];
        const summaryMeta =
            model && groupSummary
                ? (() => {
                      const n = model.responseCount;
                      const nLabel = `${n} ${n === 1 ? 'response' : 'responses'}`;
                      if (tied.length > 1) {
                          return `${nLabel} · Tie: ${tied.map((m) => modeLabel(m)).join(', ')}`;
                      }
                      return `${nLabel} · Top: ${modeLabel(groupSummary.topMode)}`;
                  })()
                : 'No responses yet';

        const detailsKey = `gs-${groupSummary?.submissionsCount ?? 0}-${groupSummary?.topMode ?? 'none'}`;

        return (
            <details
                key={detailsKey}
                className="trip-route-preference-group-details"
                defaultOpen
            >
                <summary className="trip-route-preference-group-summary">
                    <span className="trip-route-preference-group-summary-title">
                        <span className="trip-route-preference-group-chevron" aria-hidden>
                            ▼
                        </span>
                        Group summary
                    </span>
                    <span className="trip-route-preference-group-summary-meta">{summaryMeta}</span>
                </summary>
                <div className="trip-route-preference-group-body">
                    {model && groupSummary
                        ? renderGroupSummaryBars(groupSummary, model)
                        : renderGroupSummaryEmptyBars()}
                </div>
            </details>
        );
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
                    <div className="trip-dates"><strong>Dates: </strong>{new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}</div>
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
                <div className="details-content-header">
                    <h2 id="trip-routes-heading">Routes</h2>
                    {hasCollaborators && (
                        <button
                            type="button"
                            className="trip-route-preference-open"
                            onClick={() => {
                                setPreferenceError('');
                                setShowPreferencesModal(true);
                            }}
                            aria-describedby="trip-routes-heading"
                        >
                            Group Transport Preferences
                        </button>
                    )}
                </div>

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

            {hasCollaborators && showPreferencesModal && (
                <div
                    className="trip-route-preference-modal-overlay"
                    onClick={() => {
                        if (isSavingPreference) return;
                        setShowPreferencesModal(false);
                    }}
                >
                    <section className="trip-route-preference-panel" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="trip-route-preference-cancel"
                            onClick={() => setShowPreferencesModal(false)}
                            disabled={isSavingPreference}
                        >
                            ← Cancel
                        </button>
                        <div className="trip-route-preference-header">
                            <h2>Mode of Transport Preference</h2>
                            {isLoadingPreferenceData ? <p>Loading...</p> : null}
                        </div>
                        <p className="trip-route-preference-help">
                            Rank transport modes from highest to lowest preference.
                        </p>
                        <ol className="trip-route-preference-list">
                            {TRANSPORT_MODES.map((mode) => (
                                <li key={mode} className="trip-route-preference-item">
                                    <div className="trip-route-preference-buttons">
                                            <label htmlFor={`rank-${mode}`} className="visually-hidden">
                                                Rank for {modeLabel(mode)}
                                            </label>
                                            <select
                                                id={`rank-${mode}`}
                                                value={rankByMode[mode]}
                                                onChange={(e) => handleRankSelectChange(mode, e.target.value)}
                                                disabled={isSavingPreference}
                                            >
                                                <option value="">--</option>
                                                {[1, 2, 3, 4, 5].map((rank) => (
                                                    <option
                                                        key={`${mode}-${rank}`}
                                                        value={rank}
                                                    >
                                                        {rank}
                                                    </option>
                                                ))}
                                            </select>
                                    </div>
                                    <span>{modeLabel(mode)}</span>
                                </li>
                            ))}
                        </ol>
                        <div className="trip-route-preference-modal-actions">
                            <button
                                type="button"
                                className="trip-route-preference-save"
                                onClick={handleSavePreferences}
                                disabled={isSavingPreference || isLoadingPreferenceData}
                            >
                                {isSavingPreference ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>
                        {renderModalGroupSummary()}
                        {preferenceError ? <p className="trip-route-preference-error">{preferenceError}</p> : null}
                    </section>
                </div>
            )}
        </div>
    )
}