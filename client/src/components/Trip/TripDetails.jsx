import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { deleteRoute } from '../../services/routeServices';
import { sendTripInvitation, listTripInvitations } from '../../services/invitationServices';
import { getRoutePreferences, saveMyRoutePreference } from '../../services/routePreferenceServices';
import { useUser } from '../../../context/useUser';
import { getTripById, updatePackingList } from '../../services/tripServices';

import './TripDetails.css';

function mongoIdString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.$oid) return value.$oid;
    return String(value);
}

const TABS = [
    { id: 'timeline',       label: 'Timeline',       icon: '◈' },
    { id: 'routes',         label: 'Routes',          icon: '⇢' },
    { id: 'accommodations', label: 'Accommodations',  icon: '⌂' },
    { id: 'map',            label: 'Map',             icon: '◎' },
    { id: 'collaboration',  label: 'Collaboration',   icon: '⌘' },
    { id: 'changelog',      label: 'Changelog',       icon: '◷' },
    { id: 'packinglist',    label: 'Packing List',  icon: '✓' },
];

const toYYYYMMDD = (dateValue) => {
    if (!dateValue) return null;
    // handle MongoDB $date format or standard ISO strings
    const date = new Date(dateValue?.$date || dateValue);
    if (isNaN(date.getTime())) return null;
    
    // use UTC methods to avoid timezone issues and ensure consistent date formatting
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

export default function TripDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { dbUser } = useUser();

    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState('timeline');
    const [showAddMenu, setShowAddMenu] = useState(false);

    const [showConfirm, setShowConfirm] = useState(false);
    const [routeToDelete, setRouteToDelete] = useState(null);

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

    const [packingItems, setPackingItems] = useState([])
    const [newItemText, setNewItemText] = useState('')
    const [editingItemId, setEditingItemId] = useState(null)
    const [editingItemText, setEditingItemText] = useState('')
    const packingInputRef = useRef(null)

    const TRANSPORT_MODES = ['RIDESHARE', 'PERSONAL_VEHICLE', 'BUS', 'TRAIN', 'FLIGHT'];
    const [rankByMode, setRankByMode] = useState({
        RIDESHARE: '', PERSONAL_VEHICLE: '', BUS: '', TRAIN: '', FLIGHT: '',
    });

    // ── data fetching ─────────────────────────────────────────────────────────

    useEffect(() => {
        const fetchTripDetails = async () => {
            if (!dbUser?._id) { setLoading(false); return; }
            try {
                const data = await getTripById(id, dbUser._id);
                setTrip(data);
            } catch (error) {
                console.error('Error fetching trip details:', error);
                setTrip(null);
            } finally {
                setLoading(false);
            }
        };
        fetchTripDetails();
    }, [id, dbUser?._id]);

    useEffect(() => {
        if (!trip || !dbUser?._id) return;
        const owner = mongoIdString(trip.owner) === mongoIdString(dbUser._id);
        if (!owner) { setTripInvitations([]); setInviteLoadError(null); return; }
        const tid = id || mongoIdString(trip._id);
        let cancelled = false;
        (async () => {
            try {
                setInviteLoadError(null);
                const list = await listTripInvitations(tid, dbUser._id);
                if (!cancelled) setTripInvitations(Array.isArray(list) ? list : []);
            } catch (e) {
                if (!cancelled) {
                    setTripInvitations([]);
                    setInviteLoadError(e?.response?.data?.error || 'Could not load invitation activity.');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [trip, dbUser?._id, id]);

    useEffect(() => {
        if (!trip || !dbUser?._id) return;
        const hasCollaborators = Array.isArray(trip?.collaboratorIds) && trip.collaboratorIds.length > 0;
        if (!hasCollaborators) {
            setGroupSummary(null); setPreferenceError('');
            setRankByMode({ RIDESHARE: '', PERSONAL_VEHICLE: '', BUS: '', TRAIN: '', FLIGHT: '' });
            return;
        }
        let cancelled = false;
        (async () => {
            setIsLoadingPreferenceData(true); setPreferenceError('');
            try {
                const tripId = id || mongoIdString(trip._id);
                const uid = mongoIdString(dbUser._id);
                const prefData = await getRoutePreferences(tripId, uid);
                if (!cancelled) {
                    setGroupSummary(prefData?.groupSummary || null);
                    if (prefData?.myPreference?.rankByMode) {
                        setRankByMode(normalizeRankByMode(prefData.myPreference.rankByMode));
                    } else if (prefData?.myPreference?.ranking) {
                        setRankByMode(buildRankByModeFromRanking(normalizeRanking(prefData.myPreference.ranking)));
                    } else {
                        setRankByMode({ RIDESHARE: '', PERSONAL_VEHICLE: '', BUS: '', TRAIN: '', FLIGHT: '' });
                    }
                }
            } catch (err) {
                if (!cancelled) setPreferenceError(err?.response?.data?.error || 'Could not load route preferences.');
            } finally {
                if (!cancelled) setIsLoadingPreferenceData(false);
            }
        })();
        return () => { cancelled = true; };
    }, [trip, id, dbUser?._id]);

    useEffect(() => {
        if (!trip || !dbUser?._id) return;
        const hasCollaborators = Array.isArray(trip?.collaboratorIds) && trip.collaboratorIds.length > 0;
        if (!hasCollaborators) return;
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            const tripId = id || mongoIdString(trip._id);
            getRoutePreferences(tripId, mongoIdString(dbUser._id))
                .then((prefData) => setGroupSummary(prefData?.groupSummary || null))
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
                if (!cancelled) setGroupSummary(prefData?.groupSummary || null);
            } catch (err) { console.error('Error loading route preferences (modal):', err); }
        })();
        return () => { cancelled = true; };
    }, [showPreferencesModal, trip, id, dbUser?._id]);

    useEffect(() => {
        if (!location.state?.fromRouteDetails || !id || !dbUser?._id) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await getTripById(id, mongoIdString(dbUser._id));
                if (!cancelled) setTrip(data);
            } catch (error) { console.error('Error refreshing trip details:', error); }
        })();
        return () => { cancelled = true; };
    }, [location.state?.fromRouteDetails, id, dbUser?._id]);

    useEffect(() => {
        const handleClick = () => setShowAddMenu(false);
    
        if (showAddMenu) {
            window.addEventListener('click', handleClick);
        }
    
        return () => window.removeEventListener('click', handleClick);
    }, [showAddMenu]);

    // Initialize from trip data when it loads
    useEffect(() => {
        if (trip?.packingList) {
            setPackingItems(trip.packingList)
        }
    }, [trip]);

    // ── helpers ───────────────────────────────────────────────────────────────

    const handleAddPackingItem = () => {
        const text = newItemText.trim()
        if (!text) return
        const updatedItems = [...packingItems, { id: crypto.randomUUID(), text, checked: false }]
        setPackingItems(updatedItems)
        savePackingList(updatedItems)
        setNewItemText('')
      }
      
      const handleTogglePackingItem = (id) => {
        const updatedItems = packingItems.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item
        )
        setPackingItems(updatedItems)
        savePackingList(updatedItems)
      }
      
      const handleDeletePackingItem = (id) => {
        const updatedItems = packingItems.filter((item) => item.id !== id)
        setPackingItems(updatedItems)
        savePackingList(updatedItems)
      }
      
      // keep these two unchanged
      const handleStartEditPackingItem = (item) => {
        setEditingItemId(item.id)
        setEditingItemText(item.text)
      }
      
      const handleSaveEditPackingItem = (id) => {
        const text = editingItemText.trim()
        if (!text) return
        const updatedItems = packingItems.map((item) =>
          item.id === id ? { ...item, text } : item
        )
        setPackingItems(updatedItems)
        savePackingList(updatedItems)
        setEditingItemId(null)
        setEditingItemText('')
      }
      
      const handleCancelEditPackingItem = () => {
        setEditingItemId(null)
        setEditingItemText('')
      }

      const savePackingList = async (updatedItems) => {
        try {
          await updatePackingList(mongoIdString(trip._id), updatedItems, mongoIdString(dbUser._id))
        } catch (err) {
          console.error('Failed to save packing list:', err)
        }
      }
    
    const calculateTotalCost = (routes) =>
        routes.reduce((total, route) => total + (Number(route.totalCost) || 0), 0);

    const formatDate = (dateObj) => {
        const dateString = dateObj?.$date || dateObj;
        if (!dateString) return 'MM/DD';
        const date = new Date(dateString);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    const formatTime = (dateObj) => {
        const dateString = dateObj?.$date || dateObj;
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatShortUsLocation = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return 'Unknown';
        const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
        const hasUS = parts.some((p) => /^(united states|united states of america|usa|us)$/i.test(p));
        if (hasUS) {
            const city = parts[0] || 'Unknown';
            const state = parts[1] || '';
            return state ? `${city}, ${state}, USA` : `${city}, USA`;
        }
        if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
        return parts[0];
    };

    const isRouteOutOfRange = (route) => {
        if (!trip?.startDate || !trip?.endDate || !route?.departAt) return false;

        const routeStr = toYYYYMMDD(route.departAt);
        const tripStartStr = toYYYYMMDD(trip.startDate);
        const tripEndStr = toYYYYMMDD(trip.endDate);

        return (routeStr < tripStartStr) || (routeStr > tripEndStr);
    };

    const getRouteTitle = (route) => {
        const from = formatShortUsLocation(route?.origin?.address || route?.origin?.name);
        const to = formatShortUsLocation(route?.destination?.address || route?.destination?.name);
        return `${from} to ${to}`;
    };

    const getRouteMetaLine = (route) => {
        const legs = Array.isArray(route?.legs) ? route.legs : [];
        if (legs.length === 0) return 'No leg details';
        const modes = legs.map((leg) => leg?.transportationMode).filter(Boolean)
            .map((mode) => { const l = String(mode).toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); });
        const uniqueModes = modes.filter((mode, idx) => idx === 0 || mode !== modes[idx - 1]);
        let stopCount = -1;
        for (const leg of legs) {
            stopCount += Array.isArray(leg?.segments) && leg.segments.length > 0 ? leg.segments.length : 1;
        }
        const stopsText = stopCount <= 0 ? 'Direct' : `${stopCount} ${stopCount === 1 ? 'Stop' : 'Stops'}`;
        return `${uniqueModes.join(' → ')} • ${stopsText}`;
    };

    const getRouteTimeLine = (route) => `${formatTime(route?.departAt)} to ${formatTime(route?.arriveAt)}`;

    const modeLabel = (mode) => ({
        RIDESHARE: 'Rideshare', PERSONAL_VEHICLE: 'Personal Vehicle',
        BUS: 'Bus', TRAIN: 'Train', FLIGHT: 'Flight',
    }[mode] || mode);

    const normalizeRanking = (ranking = []) => {
        const cleaned = ranking.map((m) => String(m || '').trim().toUpperCase());
        return cleaned.filter((m, idx) => TRANSPORT_MODES.includes(m) && cleaned.indexOf(m) === idx);
    };

    const buildRankByModeFromRanking = (ranking) => ({
        RIDESHARE:        ranking.includes('RIDESHARE')        ? ranking.indexOf('RIDESHARE') + 1        : '',
        PERSONAL_VEHICLE: ranking.includes('PERSONAL_VEHICLE') ? ranking.indexOf('PERSONAL_VEHICLE') + 1 : '',
        BUS:              ranking.includes('BUS')              ? ranking.indexOf('BUS') + 1              : '',
        TRAIN:            ranking.includes('TRAIN')            ? ranking.indexOf('TRAIN') + 1            : '',
        FLIGHT:           ranking.includes('FLIGHT')           ? ranking.indexOf('FLIGHT') + 1           : '',
    });

    const normalizeRankByMode = (raw = {}) => {
        const normalized = {};
        for (const mode of TRANSPORT_MODES) {
            const value = raw?.[mode];
            if (value === '' || value == null) { normalized[mode] = ''; continue; }
            const n = Number(value);
            normalized[mode] = Number.isInteger(n) && n >= 1 && n <= 5 ? n : '';
        }
        return normalized;
    };

    const handleRankSelectChange = (mode, value) => {
        if (value === '') { setRankByMode((prev) => ({ ...prev, [mode]: '' })); return; }
        const nextRank = Number(value);
        if (!Number.isInteger(nextRank) || nextRank < 1 || nextRank > 5) return;
        setRankByMode((prev) => ({ ...prev, [mode]: nextRank }));
    };

    const handleSavePreferences = async () => {
        if (!hasCollaborators || !dbUser?._id) return;
        setIsSavingPreference(true); setPreferenceError('');
        try {
            const tripId = id || tripIdStr;
            const uid = mongoIdString(dbUser._id);
            await saveMyRoutePreference(tripId, rankByMode, uid);
            const latest = await getRoutePreferences(tripId, uid);
            setGroupSummary(latest.groupSummary || null);
            if (latest?.myPreference?.rankByMode) setRankByMode(normalizeRankByMode(latest.myPreference.rankByMode));
            else if (latest?.myPreference?.ranking) setRankByMode(buildRankByModeFromRanking(normalizeRanking(latest.myPreference.ranking)));
            else setRankByMode({ RIDESHARE: '', PERSONAL_VEHICLE: '', BUS: '', TRAIN: '', FLIGHT: '' });
        } catch (err) {
            setPreferenceError(err?.response?.data?.error || 'Could not save preferences right now.');
        } finally {
            setIsSavingPreference(false);
        }
    };

    const handleSendInvite = async (e) => {
        e.preventDefault();
        setInviteFeedback(null);
        const email = inviteEmail.trim();
        if (!email) { setInviteFeedback({ type: 'error', text: 'Enter an email address.' }); return; }
        setInviteSending(true);
        try {
            const apiTripId = id || mongoIdString(trip._id);
            await sendTripInvitation(apiTripId, email, dbUser._id);
            setInviteEmail('');
            setInviteLoadError(null);
            const list = await listTripInvitations(apiTripId, dbUser._id);
            setTripInvitations(Array.isArray(list) ? list : []);
        } catch (err) {
            const msg = err?.response?.data?.error || err?.message || 'Could not send the invitation. Please try again.';
            setInviteFeedback({ type: 'error', text: msg });
        } finally {
            setInviteSending(false);
        }
    };

    const invitationActivityText = (inv) => {
        const email = inv.inviteeEmail || 'Unknown';
        const when = new Date(inv.updatedAt || inv.createdAt).toLocaleString();
        switch (inv.status) {
            case 'pending':  return `Invitation sent to ${email} — ${when}`;
            case 'accepted': return `${email} accepted the invitation — ${when}`;
            case 'declined': return `${email} declined the invitation — ${when}`;
            case 'revoked':  return `Invitation to ${email} was revoked — ${when}`;
            default:         return `${email} — ${inv.status} — ${when}`;
        }
    };

    const buildGroupSummaryModel = (summary) => {
        if (!summary || summary.submissionsCount <= 0) return null;
        const responseCount = summary.submissionsCount;
        const avgForMode = (mode) => (summary.scores[mode] ?? 0) / responseCount;
        const avgScores = TRANSPORT_MODES.map((m) => avgForMode(m));
        const minAvg = Math.min(...avgScores);
        const maxAvg = Math.max(...avgScores);
        return { responseCount, avgForMode, maxAvg, avgSpan: maxAvg - minAvg };
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
                    const pct = model.avgSpan === 0 ? 100 : Math.round((100 * (model.maxAvg - avg)) / model.avgSpan);
                    const isTopPick = (summary.tiedModes || []).includes(mode);
                    return (
                        <div key={mode} className="group-transport-bar-row" role="listitem">
                            <span className="group-transport-bar-label">{modeLabel(mode)}</span>
                            <div className="group-transport-bar-track" aria-hidden="true">
                                <div
                                    className={isTopPick
                                        ? 'group-transport-bar-fill group-transport-bar-fill--top'
                                        : 'group-transport-bar-fill'}
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
                        <div className="group-transport-bar-fill group-transport-bar-fill--empty" style={{ width: '0%' }} />
                    </div>
                </div>
            ))}
        </div>
    );

    const renderModalGroupSummary = () => {
        if (!hasCollaborators) return null;
        const model = groupSummary ? buildGroupSummaryModel(groupSummary) : null;
        const tied = groupSummary?.tiedModes || [];
        const summaryMeta = model && groupSummary
            ? (() => {
                const n = model.responseCount;
                const nLabel = `${n} ${n === 1 ? 'response' : 'responses'}`;
                if (tied.length > 1) return `${nLabel} · Tie: ${tied.map((m) => modeLabel(m)).join(', ')}`;
                return `${nLabel} · Top: ${modeLabel(groupSummary.topMode)}`;
            })()
            : 'No responses yet';
        const detailsKey = `gs-${groupSummary?.submissionsCount ?? 0}-${groupSummary?.topMode ?? 'none'}`;
        return (
            <details key={detailsKey} className="trip-route-preference-group-details" defaultOpen>
                <summary className="trip-route-preference-group-summary">
                    <span className="trip-route-preference-group-summary-title">
                        <span className="trip-route-preference-group-chevron" aria-hidden>▼</span>
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

    const renderPackingList = () => (
        <div className="td-tab-content">
          <div className="td-content-header">
            <h2>Packing List</h2>
            <span className="td-packing-count">
              {packingItems.filter((i) => i.checked).length}/{packingItems.length} packed
            </span>
          </div>
      
          <div className="td-packing-add-row">
            <input
              ref={packingInputRef}
              type="text"
              className="td-packing-input"
              placeholder="Add an item…"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddPackingItem() }}
            />
            <button className="td-packing-add-btn" onClick={handleAddPackingItem}>
              Add
            </button>
          </div>
      
          {packingItems.length === 0 ? (
            <div className="td-empty-state">
              <span className="td-empty-icon">✓</span>
              <p>No items yet. Add something above.</p>
            </div>
          ) : (
            <ul className="td-packing-list">
              {packingItems.map((item) => (
                <li key={item.id} className={`td-packing-item${item.checked ? ' td-packing-item--checked' : ''}`}>
                  <input
                    type="checkbox"
                    className="td-packing-checkbox"
                    checked={item.checked}
                    onChange={() => handleTogglePackingItem(item.id)}
                    aria-label={`Mark ${item.text} as ${item.checked ? 'unpacked' : 'packed'}`}
                  />
      
                  {editingItemId === item.id ? (
                    <>
                      <input
                        type="text"
                        className="td-packing-edit-input"
                        value={editingItemText}
                        onChange={(e) => setEditingItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditPackingItem(item.id)
                          if (e.key === 'Escape') handleCancelEditPackingItem()
                        }}
                        autoFocus
                      />
                      <button className="td-packing-save-btn" onClick={() => handleSaveEditPackingItem(item.id)}>Save</button>
                      <button className="td-packing-cancel-btn" onClick={handleCancelEditPackingItem}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="td-packing-item-text">{item.text}</span>
                      <button className="td-packing-edit-btn" onClick={() => handleStartEditPackingItem(item)}>Edit</button>
                      <button className="td-packing-delete-btn" onClick={() => handleDeletePackingItem(item.id)}>Delete</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
    )

    if (loading) {
        return (
            <div className="td-shell">
                <div className="td-loading">
                    <div className="td-loading-dot" />
                    <div className="td-loading-dot" />
                    <div className="td-loading-dot" />
                </div>
            </div>
        );
    }
    if (!dbUser?._id) return <div className="td-shell td-empty"><p>Sign in to view this trip.</p></div>;
    if (!trip)        return <div className="td-shell td-empty"><p>Trip not found.</p></div>;

    const currentTotal = trip.routes ? calculateTotalCost(trip.routes) : 0;
    const sortedRoutes = trip.routes
        ? [...trip.routes].sort((a, b) =>
            new Date(a.departAt?.$date || a.departAt) - new Date(b.departAt?.$date || b.departAt))
        : [];

    const tripIdStr = mongoIdString(trip._id);
    const isTripOwner = mongoIdString(trip.owner) === mongoIdString(dbUser?._id);
    const hasCollaborators = Array.isArray(trip?.collaboratorIds) && trip.collaboratorIds.length > 0;

    const renderTimeline = () => (
        <div className="td-tab-content">
            <div className="td-content-header">
                <h2>Timeline</h2>
                {hasCollaborators && (
                    <button
                        type="button"
                        className="trip-route-preference-open"
                        onClick={() => { setPreferenceError(''); setShowPreferencesModal(true); }}
                    >
                        Group Transport Preferences
                    </button>
                )}
            </div>
            {sortedRoutes.length === 0 ? (
                <div className="td-empty-state">
                    <span className="td-empty-icon">◈</span>
                    <p>No routes added to this trip yet.</p>
                </div>
            ) : (
                <div className="td-timeline">
                    {sortedRoutes.map((route, index) => {
                        const currentDate = formatDate(route.departAt);
                        const previousDate = index > 0 ? formatDate(sortedRoutes[index - 1].departAt) : null;
                        const isSameDay = currentDate === previousDate;
                        const outOfRange = isRouteOutOfRange(route);

                        return (
                            <div key={index} className={`td-timeline-entry${isSameDay ? ' same-day' : ''}`}>
                                <div className="td-timeline-date-circle">
                                    {!isSameDay ? currentDate : ''}
                                </div>

                                <div className={`td-route-card ${outOfRange ? 'td-route-card--warning' : ''}`}>
                                    <div className="td-route-info">
                                        <h3>
                                            {outOfRange && <span title="Outside trip dates">⚠️ </span>}
                                            {getRouteTitle(route)}
                                        </h3>
                                        <p>{getRouteMetaLine(route)}</p>
                                        <p>{getRouteTimeLine(route)}</p>
                                    </div>

                                    <div className="td-route-actions">
                                        <button
                                            className="td-btn-view"
                                            onClick={() => navigate('/view-route-details', {
                                                state: { selectedRoute: route, fromTripDetails: true, tripId: trip._id }
                                            })}
                                        >
                                            View Details
                                        </button>
                                        {isTripOwner && (
                                            <button
                                                className="td-btn-delete"
                                                onClick={() => { setRouteToDelete(route); setShowConfirm(true); }}
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
            )}
        </div>
    );

    const renderRoutes = () => (
        <div className="td-tab-content">
            <div className="td-content-header">
                <h2>Routes</h2>
                {hasCollaborators && (
                    <button
                        type="button"
                        className="trip-route-preference-open"
                        onClick={() => { setPreferenceError(''); setShowPreferencesModal(true); }}
                    >
                        Group Transport Preferences
                    </button>
                )}
            </div>
            {sortedRoutes.length === 0 ? (
                <div className="td-empty-state">
                    <span className="td-empty-icon">⇢</span>
                    <p>No routes added to this trip yet.</p>
                </div>
            ) : (
                <div className="td-routes-list">
                    {sortedRoutes.map((route, index) => {
                        const outOfRange = isRouteOutOfRange(route);

                        return (
                            <div key={index} className={`td-route-row${isRouteOutOfRange(route) ? ' td-route-row--warning' : ''}`}>
                                <div className="td-route-row-info">
                                    <span className="td-route-row-date">{formatDate(route.departAt)}</span>
                                    <div>
                                        <h3 className="td-route-title">
                                            {outOfRange && <span title="Outside trip dates">⚠️ </span>}
                                            {getRouteTitle(route)}
                                        </h3>
                                        <p className="td-route-meta">{getRouteMetaLine(route)} · {getRouteTimeLine(route)}</p>
                                    </div>
                                </div>
                                <div className="td-route-actions">
                                    <button
                                        className="td-btn-view"
                                        onClick={() => navigate('/view-route-details', {
                                            state: { selectedRoute: route, fromTripDetails: true, tripId: trip._id }
                                        })}
                                    >
                                        View Details
                                    </button>
                                    {isTripOwner && (
                                        <button
                                            className="td-btn-delete"
                                            onClick={() => { setRouteToDelete(route); setShowConfirm(true); }}
                                        >
                                            Delete Route
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {/* {sortedRoutes.map((route, index) => (
                        <div key={index} className="td-route-row">
                            <div className="td-route-row-info">
                                <span className="td-route-row-date">{formatDate(route.departAt)}</span>
                                <div>
                                    <h3 className="td-route-title">{getRouteTitle(route)}</h3>
                                    <p className="td-route-meta">{getRouteMetaLine(route)} · {getRouteTimeLine(route)}</p>
                                </div>
                            </div>
                            <div className="td-route-actions">
                                <button
                                    className="td-btn-view"
                                    onClick={() => navigate('/view-route-details', {
                                        state: { selectedRoute: route, fromTripDetails: true, tripId: trip._id }
                                    })}
                                >
                                    View Details
                                </button>
                                {isTripOwner && (
                                    <button
                                        className="td-btn-delete"
                                        onClick={() => { setRouteToDelete(route); setShowConfirm(true); }}
                                    >
                                        Delete Route
                                    </button>
                                )}
                            </div>
                        </div>
                    ))} */}
                </div>
            )}
        </div>
    );

    const renderComingSoon = (icon, label) => (
        <div className="td-tab-content">
            <div className="td-content-header"><h2>{label}</h2></div>
            <div className="td-empty-state td-empty-state--soon">
                <span className="td-empty-icon">{icon}</span>
                <p className="td-coming-soon-label">{label}</p>
                <p className="td-coming-soon-sub">Coming soon</p>
            </div>
        </div>
    );

    const renderCollaboration = () => (
        <div className="td-tab-content">
            <div className="td-content-header"><h2>Collaboration</h2></div>

            {hasCollaborators && (
                <div style={{ marginBottom: '20px' }}>
                    <button
                        type="button"
                        className="trip-route-preference-open"
                        onClick={() => { setPreferenceError(''); setShowPreferencesModal(true); }}
                    >
                        Group Transport Preferences
                    </button>
                </div>
            )}

            {isTripOwner ? (
                <section className="td-invite-section" aria-labelledby="invite-heading">
                    <h3 className="td-section-heading" id="invite-heading">Invite Collaborators</h3>
                    <form className="td-invite-form" onSubmit={handleSendInvite}>
                        <label htmlFor="collaborator-email" className="visually-hidden">Collaborator email</label>
                        <input
                            id="collaborator-email"
                            type="email"
                            name="email"
                            autoComplete="email"
                            placeholder="name@example.com"
                            value={inviteEmail}
                            onChange={(e) => { setInviteEmail(e.target.value); if (inviteFeedback) setInviteFeedback(null); }}
                            disabled={inviteSending}
                            className="td-invite-input"
                        />
                        <button type="submit" className="td-invite-submit" disabled={inviteSending}>
                            {inviteSending ? 'Sending…' : 'Send invitation'}
                        </button>
                    </form>
                    {inviteFeedback?.type === 'error' && (
                        <p className="td-invite-error" role="alert">{inviteFeedback.text}</p>
                    )}

                    <details className="invite-activity-details" defaultOpen>
                        <summary className="invite-activity-summary">
                            Invitation activity
                            {tripInvitations.length > 0 && (
                                <span className="invite-activity-count">({tripInvitations.length})</span>
                            )}
                        </summary>
                        <div className="invite-activity-body">
                            {inviteLoadError && (
                                <p className="td-invite-error" role="alert">{inviteLoadError}</p>
                            )}
                            {!inviteLoadError && tripInvitations.length === 0 && (
                                <p className="invite-activity-empty">No invitation activity yet.</p>
                            )}
                            {!inviteLoadError && tripInvitations.length > 0 && (
                                <ul className="invite-activity-list">
                                    {tripInvitations.map((inv) => (
                                        <li key={mongoIdString(inv._id)} className="invite-activity-item">
                                            {invitationActivityText(inv)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </details>
                </section>
            ) : (
                <div className="td-empty-state">
                    <span className="td-empty-icon">⌘</span>
                    <p>You're a collaborator on this trip.</p>
                </div>
            )}
        </div>
    );

    const tabContent = {
        timeline:       renderTimeline,
        routes:         renderRoutes,
        accommodations: () => renderComingSoon('⌂', 'Accommodations'),
        map:            () => renderComingSoon('◎', 'Map'),
        collaboration:  renderCollaboration,
        changelog:      () => renderComingSoon('◷', 'Changelog'),
        packinglist:    renderPackingList,
    };

    // ── render ────────────────────────────────────────────────────────────────

    return (
        <div className="td-shell">
            {/* ── Sidebar ── */}
            <aside className={`td-sidebar ${sidebarOpen ? 'td-sidebar--open' : 'td-sidebar--closed'}`}>
                <button
                    className="td-sidebar-toggle"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle sidebar"
                >
                    {sidebarOpen ? '◀' : '▶'}
                </button>

                {sidebarOpen && (
                    <>
                        <div className="td-sidebar-actions">
                            <div className="td-dropdown">
                                <button
                                    className="td-sidebar-action-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAddMenu(prev => !prev);
                                    }}
                                >
                                    <span className="td-sidebar-action-icon">＋</span>
                                    <span>Add Items</span>
                                </button>

                                {showAddMenu && (
                                    <div className="td-dropdown-menu">
                                        <button
                                            className="td-dropdown-item"
                                            onClick={() => navigate(`/create-route`, { state: { tripId: trip._id } }) }
                                        >
                                            Add Route
                                        </button>
                                        <button
                                            className="td-dropdown-item"
                                            onClick={() => navigate(`/add-accommodation`, { state: { tripId: trip._id } })}
                                        >
                                            Add Accommodation
                                        </button>
                                        <button
                                            className="td-dropdown-item"
                                            onClick={() => navigate(`/add-activity`, { state: { tripId: trip._id } })}
                                        >
                                            Add Activity
                                        </button>
                                    </div>
                                )}
                            </div>
                            {isTripOwner && (
                                <button
                                    className="td-sidebar-action-btn td-sidebar-action-btn--outline"
                                    onClick={() => navigate(`/edit-trip/${id}`)}
                                >
                                    <span className="td-sidebar-action-icon">✎</span>
                                    <span>Edit Trip</span>
                                </button>
                            )}
                            {isTripOwner && (
                                <button
                                    className="td-sidebar-action-btn td-sidebar-action-btn--outline"
                                    onClick={() => setActiveTab('collaboration')}
                                >
                                    <span className="td-sidebar-action-icon">✉</span>
                                    <span>Invite Friends</span>
                                </button>
                            )}
                        </div>

                        <div className="td-sidebar-divider" />

                        <nav className="td-sidebar-nav" aria-label="Trip sections">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    className={`td-sidebar-tab${activeTab === tab.id ? ' td-sidebar-tab--active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <span className="td-sidebar-tab-icon">{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                    </>
                )}

                {!sidebarOpen && (
                    <nav className="td-sidebar-nav td-sidebar-nav--collapsed" aria-label="Trip sections">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                className={`td-sidebar-tab td-sidebar-tab--icon-only${activeTab === tab.id ? ' td-sidebar-tab--active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                title={tab.label}
                            >
                                {tab.icon}
                            </button>
                        ))}
                    </nav>
                )}
            </aside>

            {/* ── Main ── */}
            <main className="td-main">
                <button className="td-back-btn" onClick={() => navigate('/my-trips')}>← Back</button>

                {/* Trip Header — always visible */}
                <header className="td-trip-header">
                    <h1 className="td-trip-name">{trip.name}</h1>
                    {trip.description && <p className="td-trip-desc">{trip.description}</p>}
                    <div className="td-trip-meta-row">
                        <span>
                            <strong>Dates:</strong>&nbsp;
                            {new Date(trip.startDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                            {' – '}
                            {new Date(trip.endDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                        </span>
                        <span>
                            <strong>Budget:</strong>&nbsp;${trip.budget?.toFixed(2) || 'N/A'}
                        </span>
                        <span className={currentTotal > trip.budget ? 'td-trip-meta-over' : ''}>
                            <strong>Total Cost:</strong>&nbsp;${currentTotal.toFixed(2)}
                            {currentTotal > trip.budget && ' ⚠ Over budget'}
                        </span>
                    </div>
                </header>

                {/* Tab content — no tab bar visible here */}
                <div className="td-content-area">
                    {(tabContent[activeTab] || (() => null))()}
                </div>
            </main>

            {/* ── Delete Route Confirm ── */}
            {showConfirm && (
                <div className="td-modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="td-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Confirm Delete</h3>
                        <p>Delete "{routeToDelete?.name || getRouteTitle(routeToDelete)}"?</p>
                        <div className="td-modal-actions">
                            <button
                                className="td-modal-btn td-modal-btn--danger"
                                onClick={async () => {
                                    const tripId = typeof trip._id === 'string' ? trip._id : trip._id?.$oid ?? String(trip._id);
                                    await deleteRoute(tripId, routeToDelete._id, dbUser._id);
                                    const updatedTrip = await getTripById(tripId, dbUser._id);
                                    setTrip(updatedTrip);
                                    setShowConfirm(false);
                                    window.dispatchEvent(new Event('refreshNotifications'));
                                }}
                            >
                                Confirm
                            </button>
                            <button className="td-modal-btn td-modal-btn--cancel" onClick={() => setShowConfirm(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Transport Preferences Modal ── */}
            {hasCollaborators && showPreferencesModal && (
                <div
                    className="trip-route-preference-modal-overlay"
                    onClick={() => { if (isSavingPreference) return; setShowPreferencesModal(false); }}
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
                            {isLoadingPreferenceData && <p>Loading...</p>}
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
                                                <option key={`${mode}-${rank}`} value={rank}>{rank}</option>
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
                        {preferenceError && <p className="trip-route-preference-error">{preferenceError}</p>}
                    </section>
                </div>
            )}
        </div>
    );
}
