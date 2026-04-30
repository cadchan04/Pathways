import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { deleteRoute } from '../../services/routeServices';
import { sendTripInvitation, listTripInvitations } from '../../services/invitationServices';
import { getRoutePreferences, saveMyRoutePreference } from '../../services/routePreferenceServices';
import { getAccommodationActivityPreferences, saveMyAccommodationActivityPreferences } from '../../services/accommodationActivityPreferenceServices';
import { getAccommodations, deleteAccommodation } from '../../services/accommodationServices';
import { getActivities, deleteActivity } from '../../services/activityServices';
import { useUser } from '../../../context/useUser';
import AccommodationsTab from '../Accommodation/AccommodationsTab';
import ActivitiesTab from '../Activity/ActivitiesTab';
import TripChangelog from './TripChangelog';
import {
    getTripById,
    getTripChangelog,
    rollbackTripVersion,
    updatePackingList,
    duplicateTrip,
    leaveTrip,
    createItineraryOption,
    getItineraryOptions,
    updateItineraryOption,
    deleteItineraryOption,
    reviewItineraryOption,
    addItineraryOptionComment,
} from '../../services/tripServices';
import { tripRoleForUser, hasCollaboratorsOnTrip, canEditTripAsUser } from '../Collaboration/tripCollaboration';
import RouteMap from './RouteMap';
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

import './TripDetails.css';

function mongoIdString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.$oid) return value.$oid;
    return String(value);
}

function extractApiErrorMessage(err, fallback) {
    const payload = err?.response?.data;
    if (typeof payload === 'string' && payload.trim()) return payload;
    if (payload && typeof payload === 'object') {
        if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
        if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
    }
    if (typeof err?.message === 'string' && err.message.trim()) return err.message;
    return fallback;
}

const TABS = [
    { id: 'timeline',       label: 'Timeline',       icon: '◈' },
    { id: 'routes',         label: 'Routes',          icon: '⇢' },
    { id: 'accommodations', label: 'Accommodations',  icon: '⌂' },
    { id: 'activities',     label: 'Activities',      icon: '☼' },
    { id: 'map',            label: 'Map',             icon: '◎' },
    { id: 'collaboration',  label: 'Collaboration',   icon: '⌘' },
    { id: 'itineraryoptions', label: 'Group Options', icon: '☰' },
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
    const [accommodations, setAccommodations] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'timeline');
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [selectedAcc, setSelectedAcc] = useState(null);
    const [showAccModal, setShowAccModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [showActivityModal, setShowActivityModal] = useState(false);

    const [showConfirm, setShowConfirm] = useState(false);
    const [routeToDelete, setRouteToDelete] = useState(null);

    const [showAccConfirm, setShowAccConfirm] = useState(false);
    const [accToDelete, setAccToDelete] = useState(null);

    const [showActivityConfirm, setShowActivityConfirm] = useState(false);
    const [activityToDelete, setActivityToDelete] = useState(null);

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');
    const [inviteSending, setInviteSending] = useState(false);
    const [sidebarDuplicating, setSidebarDuplicating] = useState(false);
    const [sidebarLeaving, setSidebarLeaving] = useState(false);
    const [inviteFeedback, setInviteFeedback] = useState(null);
    const [tripInvitations, setTripInvitations] = useState([]);
    const [inviteLoadError, setInviteLoadError] = useState(null);
    const [isLoadingPreferenceData, setIsLoadingPreferenceData] = useState(false);
    const [isSavingPreference, setIsSavingPreference] = useState(false);
    const [preferenceError, setPreferenceError] = useState('');
    const [groupSummary, setGroupSummary] = useState(null);
    const [groupCategorySummary, setGroupCategorySummary] = useState({ accommodation: null, activity: null });
    const [showPreferencesModal, setShowPreferencesModal] = useState(false);
    const [itineraryOptions, setItineraryOptions] = useState([]);
    const [isLoadingItineraryOptions, setIsLoadingItineraryOptions] = useState(false);
    const [itineraryOptionsError, setItineraryOptionsError] = useState('');
    const [showItineraryOptionModal, setShowItineraryOptionModal] = useState(false);
    const [itineraryFormMode, setItineraryFormMode] = useState('create');
    const [editingItineraryOptionId, setEditingItineraryOptionId] = useState(null);
    const [itinerarySaveError, setItinerarySaveError] = useState('');
    const [isSavingItineraryOption, setIsSavingItineraryOption] = useState(false);
    const [voteError, setVoteError] = useState('');
    const [voteSubmittingByOptionId, setVoteSubmittingByOptionId] = useState({});
    const [selectedItineraryOption, setSelectedItineraryOption] = useState(null);
    const [showItineraryDetailsModal, setShowItineraryDetailsModal] = useState(false);
    const [itineraryCommentText, setItineraryCommentText] = useState('');
    const [itineraryCommentError, setItineraryCommentError] = useState('');
    const [itineraryCommentSubmitting, setItineraryCommentSubmitting] = useState(false);
    const [showDeleteItineraryConfirm, setShowDeleteItineraryConfirm] = useState(false);
    const [itineraryOptionToDelete, setItineraryOptionToDelete] = useState(null);
    const [isDeletingItineraryOption, setIsDeletingItineraryOption] = useState(false);
    const [itineraryDayPlans, setItineraryDayPlans] = useState([]);
    const [itineraryForm, setItineraryForm] = useState({
        title: '',
        summary: '',
    });
    const [itineraryActiveMenuId, setItineraryActiveMenuId] = useState(null);
    const [changelog, setChangelog] = useState([]);
    const [changelogLoading, setChangelogLoading] = useState(false);
    const [changelogError, setChangelogError] = useState('');
    const [rollbackTarget, setRollbackTarget] = useState(null);
    const [rollbackSaving, setRollbackSaving] = useState(false);
    const [rollbackError, setRollbackError] = useState('');
    const [rollbackMessage, setRollbackMessage] = useState('');

    // Packing list
    const [packingItems, setPackingItems] = useState([])
    const [newItemText, setNewItemText] = useState('')
    const [editingItemId, setEditingItemId] = useState(null)
    const [editingItemText, setEditingItemText] = useState('')
    const packingInputRef = useRef(null)

    // PDF Export
    const timelineRef = useRef(null);
    const packingRef = useRef(null);

    const TRANSPORT_MODES = ['RIDESHARE', 'PERSONAL_VEHICLE', 'BUS', 'TRAIN', 'FLIGHT'];
    const ACCOMMODATION_CATEGORIES = ['HOTEL', 'AIRBNB', 'HOSTEL', 'OTHER'];
    const ACTIVITY_CATEGORIES = ['SIGHTSEEING', 'DINING', 'ENTERTAINMENT', 'SHOPPING', 'OUTDOOR', 'OTHER'];
    const [rankByMode, setRankByMode] = useState({
        RIDESHARE: '', PERSONAL_VEHICLE: '', BUS: '', TRAIN: '', FLIGHT: '',
    });
    const [accommodationRankByCategory, setAccommodationRankByCategory] = useState({
        HOTEL: '', AIRBNB: '', HOSTEL: '', OTHER: '',
    });
    const [activityRankByCategory, setActivityRankByCategory] = useState({
        SIGHTSEEING: '', DINING: '', ENTERTAINMENT: '', SHOPPING: '', OUTDOOR: '', OTHER: '',
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
        const hasCollaborators = hasCollaboratorsOnTrip(trip);
        if (!hasCollaborators) {
            setGroupSummary(null); setPreferenceError('');
            setRankByMode({ RIDESHARE: '', PERSONAL_VEHICLE: '', BUS: '', TRAIN: '', FLIGHT: '' });
            setAccommodationRankByCategory({ HOTEL: '', AIRBNB: '', HOSTEL: '', OTHER: '' });
            setActivityRankByCategory({
                SIGHTSEEING: '', DINING: '', ENTERTAINMENT: '', SHOPPING: '', OUTDOOR: '', OTHER: '',
            });
            setGroupCategorySummary({ accommodation: null, activity: null });
            return;
        }
        let cancelled = false;
        (async () => {
            setIsLoadingPreferenceData(true); setPreferenceError('');
            try {
                const tripId = id || mongoIdString(trip._id);
                const uid = mongoIdString(dbUser._id);
                const [prefData, categoryPrefData] = await Promise.all([
                    getRoutePreferences(tripId, uid),
                    getAccommodationActivityPreferences(tripId, uid),
                ]);
                if (!cancelled) {
                    setGroupSummary(prefData?.groupSummary || null);
                    setGroupCategorySummary(categoryPrefData?.groupSummary || { accommodation: null, activity: null });
                    if (prefData?.myPreference?.rankByMode) {
                        setRankByMode(normalizeRankByMode(prefData.myPreference.rankByMode));
                    } else if (prefData?.myPreference?.ranking) {
                        setRankByMode(buildRankByModeFromRanking(normalizeRanking(prefData.myPreference.ranking)));
                    } else {
                        setRankByMode({ RIDESHARE: '', PERSONAL_VEHICLE: '', BUS: '', TRAIN: '', FLIGHT: '' });
                    }

                    setAccommodationRankByCategory(
                        normalizeRankByCategory(
                            categoryPrefData?.myPreference?.accommodationRankByCategory || {},
                            ACCOMMODATION_CATEGORIES
                        )
                    );
                    setActivityRankByCategory(
                        normalizeRankByCategory(
                            categoryPrefData?.myPreference?.activityRankByCategory || {},
                            ACTIVITY_CATEGORIES
                        )
                    );
                }
            } catch (err) {
                if (!cancelled) setPreferenceError(err?.response?.data?.error || 'Could not load group preferences.');
            } finally {
                if (!cancelled) setIsLoadingPreferenceData(false);
            }
        })();
        return () => { cancelled = true; };
    }, [trip, id, dbUser?._id]);

    useEffect(() => {
        if (!trip || !dbUser?._id) return;
        const hasCollaborators = hasCollaboratorsOnTrip(trip);
        if (!hasCollaborators) return;
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            const tripId = id || mongoIdString(trip._id);
            const uid = mongoIdString(dbUser._id);
            Promise.all([
                getRoutePreferences(tripId, uid),
                getAccommodationActivityPreferences(tripId, uid),
            ])
                .then(([prefData, categoryPrefData]) => {
                    setGroupSummary(prefData?.groupSummary || null);
                    setGroupCategorySummary(categoryPrefData?.groupSummary || { accommodation: null, activity: null });
                })
                .catch(() => {});
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [trip, id, dbUser?._id]);

    useEffect(() => {
        if (!showPreferencesModal || !trip || !dbUser?._id) return;
        const hc = hasCollaboratorsOnTrip(trip);
        if (!hc) return;
        let cancelled = false;
        (async () => {
            try {
                const tripId = id || mongoIdString(trip._id);
                const uid = mongoIdString(dbUser._id);
                const [prefData, categoryPrefData] = await Promise.all([
                    getRoutePreferences(tripId, uid),
                    getAccommodationActivityPreferences(tripId, uid),
                ]);
                if (!cancelled) {
                    setGroupSummary(prefData?.groupSummary || null);
                    setGroupCategorySummary(categoryPrefData?.groupSummary || { accommodation: null, activity: null });
                }
            } catch (err) { console.error('Error loading group preferences (modal):', err); }
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
        if (!trip || !id || !dbUser?._id) return;
        if (activeTab !== 'itineraryoptions') return;
        if (!hasCollaboratorsOnTrip(trip)) {
            setItineraryOptions([]);
            setItineraryOptionsError('');
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                setIsLoadingItineraryOptions(true);
                setItineraryOptionsError('');
                const options = await getItineraryOptions(id, mongoIdString(dbUser._id));
                if (!cancelled) setItineraryOptions(Array.isArray(options) ? options : []);
            } catch (err) {
                if (!cancelled) {
                    setItineraryOptions([]);
                    setItineraryOptionsError(
                        extractApiErrorMessage(err, 'Could not load itinerary options right now.')
                    );
                }
            } finally {
                if (!cancelled) setIsLoadingItineraryOptions(false);
            }
        })();

        return () => { cancelled = true; };
    }, [activeTab, trip, id, dbUser?._id]);

    const loadItineraryOptionsData = async () => {
        if (!trip || !id || !dbUser?._id) return;
        if (!hasCollaboratorsOnTrip(trip)) {
            setItineraryOptions([]);
            setItineraryOptionsError('');
            return;
        }
        setIsLoadingItineraryOptions(true);
        setItineraryOptionsError('');
        try {
            const options = await getItineraryOptions(id, mongoIdString(dbUser._id));
            setItineraryOptions(Array.isArray(options) ? options : []);
        } catch (err) {
            setItineraryOptions([]);
            setItineraryOptionsError(
                extractApiErrorMessage(err, 'Could not load itinerary options right now.')
            );
        } finally {
            setIsLoadingItineraryOptions(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'changelog' || !id || !dbUser?._id) return;

        let cancelled = false;
        const loadChangelog = async () => {
            setChangelogLoading(true);
            setChangelogError('');
            try {
                const history = await getTripChangelog(id, dbUser._id);
                if (!cancelled) setChangelog(Array.isArray(history) ? history : []);
            } catch (err) {
                if (!cancelled) {
                    setChangelog([]);
                    setChangelogError(err?.response?.data?.error || 'Could not load edit history.');
                }
            } finally {
                if (!cancelled) setChangelogLoading(false);
            }
        };

        loadChangelog();
        return () => { cancelled = true; };
    }, [activeTab, id, dbUser?._id]);

    useEffect(() => {
        const handleClick = () => setShowAddMenu(false);
    
        if (showAddMenu) {
            window.addEventListener('click', handleClick);
        }
    
        return () => window.removeEventListener('click', handleClick);
    }, [showAddMenu]);

    useEffect(() => {
        const closeMenu = () => setItineraryActiveMenuId(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const loadAllData = async () => {
        if (!id || !dbUser?._id) return;

        try {
            const [tripData, accData, activityData] = await Promise.all([
                getTripById(id, dbUser._id),
                getAccommodations(id, dbUser._id),
                getActivities(id, dbUser._id),
            ]);

            setTrip(tripData);
            setAccommodations(accData);
            setActivities(activityData);

        } catch (err) {
            console.error("Error refreshing data:", err);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [id, dbUser?._id]);

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
    
    const calculateTotalCost = (routes, activities, accommodations) => {
        let total = 0;
        if (routes) {
            total += routes.reduce((sum, route) => sum + (Number(route.totalCost) || 0), 0);
        }
        if (activities) {
            total += activities.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0);
        }
        if (accommodations) {
            total += accommodations.reduce((sum, accommodation) => sum + (Number(accommodation.cost) || 0), 0);
        }
        return total;
    };

    const formatDate = (dateInput) => {
        const date = (dateInput instanceof Date) 
            ? dateInput 
            : new Date(dateInput?.$date || dateInput);

        if (isNaN(date.getTime())) return 'MM/DD';

        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        
        return `${month}/${day}`;
    };
    /* original formatDate() function below */
    // const formatDate = (dateObj) => {
    //     const dateString = dateObj?.$date || dateObj;
    //     if (!dateString) return 'MM/DD';
    //     const date = new Date(dateString);
    //     return `${date.getMonth() + 1}/${date.getDate()}`;
    // };

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
    const accommodationCategoryLabel = (category) => ({
        HOTEL: 'Hotel', AIRBNB: 'Airbnb', HOSTEL: 'Hostel', OTHER: 'Other',
    }[category] || category);
    const activityCategoryLabel = (category) => ({
        SIGHTSEEING: 'Sightseeing', DINING: 'Dining', ENTERTAINMENT: 'Entertainment',
        SHOPPING: 'Shopping', OUTDOOR: 'Outdoor', OTHER: 'Other',
    }[category] || category);

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
    const normalizeRankByCategory = (raw = {}, categories = []) => {
        const normalized = {};
        for (const category of categories) {
            const value = raw?.[category];
            if (value === '' || value == null) { normalized[category] = ''; continue; }
            const n = Number(value);
            normalized[category] = Number.isInteger(n) && n >= 1 && n <= categories.length ? n : '';
        }
        return normalized;
    };

    const handleRankSelectChange = (mode, value) => {
        if (value === '') { setRankByMode((prev) => ({ ...prev, [mode]: '' })); return; }
        const nextRank = Number(value);
        if (!Number.isInteger(nextRank) || nextRank < 1 || nextRank > 5) return;
        setRankByMode((prev) => ({ ...prev, [mode]: nextRank }));
    };
    const handleCategoryRankSelectChange = (setState, categories, category, value) => {
        if (value === '') {
            setState((prev) => ({ ...prev, [category]: '' }));
            return;
        }
        const nextRank = Number(value);
        if (!Number.isInteger(nextRank) || nextRank < 1 || nextRank > categories.length) return;
        setState((prev) => ({ ...prev, [category]: nextRank }));
    };

    const handleSavePreferences = async () => {
        if (!trip || !hasCollaboratorsOnTrip(trip) || !dbUser?._id) return;
        setIsSavingPreference(true); setPreferenceError('');
        try {
            const tripId = id || tripIdStr;
            const uid = mongoIdString(dbUser._id);
            await Promise.all([
                saveMyRoutePreference(tripId, rankByMode, uid),
                saveMyAccommodationActivityPreferences(
                    tripId,
                    accommodationRankByCategory,
                    activityRankByCategory,
                    uid
                ),
            ]);

            const [latest, latestCategory] = await Promise.all([
                getRoutePreferences(tripId, uid),
                getAccommodationActivityPreferences(tripId, uid),
            ]);
            setGroupSummary(latest.groupSummary || null);
            setGroupCategorySummary(latestCategory?.groupSummary || { accommodation: null, activity: null });
            if (latest?.myPreference?.rankByMode) setRankByMode(normalizeRankByMode(latest.myPreference.rankByMode));
            else if (latest?.myPreference?.ranking) setRankByMode(buildRankByModeFromRanking(normalizeRanking(latest.myPreference.ranking)));
            else setRankByMode({ RIDESHARE: '', PERSONAL_VEHICLE: '', BUS: '', TRAIN: '', FLIGHT: '' });

            setAccommodationRankByCategory(
                normalizeRankByCategory(
                    latestCategory?.myPreference?.accommodationRankByCategory || {},
                    ACCOMMODATION_CATEGORIES
                )
            );
            setActivityRankByCategory(
                normalizeRankByCategory(
                    latestCategory?.myPreference?.activityRankByCategory || {},
                    ACTIVITY_CATEGORIES
                )
            );
        } catch (err) {
            setPreferenceError(err?.response?.data?.error || 'Could not save group preferences right now.');
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
            await sendTripInvitation(apiTripId, email, dbUser._id, inviteRole);
            setInviteEmail('');
            setInviteRole('viewer');
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

    const handleSidebarDuplicate = async () => {
        if (!dbUser?._id || !trip?._id) return;
        setSidebarDuplicating(true);
        try {
            await duplicateTrip(mongoIdString(trip._id), dbUser._id);
            navigate('/my-trips');
        } catch (e) {
            console.error('Duplicate trip:', e);
        } finally {
            setSidebarDuplicating(false);
        }
    };

    const handleLeaveTrip = async () => {
        if (!dbUser?._id || !trip?._id) return;
        setSidebarLeaving(true);
        try {
            await leaveTrip(mongoIdString(trip._id), dbUser._id);
            navigate('/my-trips');
        } catch (e) {
            console.error('Leave trip:', e);
        } finally {
            setSidebarLeaving(false);
        }
    };

    const handleRollbackTrip = async () => {
        if (!rollbackTarget || !dbUser?._id || !trip?._id) return;
        setRollbackSaving(true);
        setRollbackError('');
        setRollbackMessage('');
        try {
            const tripId = mongoIdString(trip._id);
            const updatedTrip = await rollbackTripVersion(
                tripId,
                mongoIdString(rollbackTarget.historyId || rollbackTarget._id),
                mongoIdString(dbUser._id)
            );
            setTrip(updatedTrip);
            setRollbackTarget(null);
            setRollbackMessage('Trip restored to the selected previous version.');
            const history = await getTripChangelog(tripId, dbUser._id);
            setChangelog(Array.isArray(history) ? history : []);
            window.dispatchEvent(new Event('refreshNotifications'));
        } catch (err) {
            setRollbackError(err?.response?.data?.error || 'Could not roll back this trip.');
        } finally {
            setRollbackSaving(false);
        }
    };

    const handleOpenAccModal = (acc) => {
        setSelectedAcc(acc);
        setShowAccModal(true);
    };

    const handleOpenActivityModal = (activity) => {
        setSelectedActivity(activity);
        setShowActivityModal(true);
    };

    const handleCloseAccModal = () => {
        setSelectedAcc(null);
        setShowAccModal(false);
    };

    const handleCloseActivityModal = () => {
        setSelectedActivity(null);
        setShowActivityModal(false);
    };

    const handleDeleteAcc = async (accId) => {
        setAccToDelete(accId);
        setShowAccConfirm(true);
    };

    const handleDeleteActivity = async (activityId) => {
        setActivityToDelete(activityId);
        setShowActivityConfirm(true);
    }

    const toDateKey = (value) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const makeDefaultDayItem = () => ({ label: '', cost: '' });

    const buildTripDayPlans = (tripValue) => {
        const startKey = toDateKey(tripValue?.startDate);
        const endKey = toDateKey(tripValue?.endDate);
        if (!startKey || !endKey) {
            return [{
                key: 'day-1',
                label: 'Day 1',
                date: null,
                items: [makeDefaultDayItem()],
            }];
        }

        const start = new Date(`${startKey}T00:00:00Z`);
        const end = new Date(`${endKey}T00:00:00Z`);
        if (end < start) {
            return [{
                key: 'day-1',
                label: 'Day 1',
                date: startKey,
                items: [makeDefaultDayItem()],
            }];
        }

        const plans = [];
        let cursor = new Date(start);
        let dayNumber = 1;
        while (cursor <= end) {
            const key = toDateKey(cursor);
            plans.push({
                key: `day-${dayNumber}`,
                label: `Day ${dayNumber}`,
                date: key,
                items: [makeDefaultDayItem()],
            });
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            dayNumber += 1;
        }
        return plans;
    };

    const mergeOptionItemsIntoDayPlans = (plans, option) => {
        const nextPlans = plans.map((plan) => ({ ...plan, items: [] }));
        const items = Array.isArray(option?.items) ? option.items : [];
        if (items.length === 0) {
            return plans;
        }

        for (const item of items) {
            const itemDateKey = toDateKey(item?.date);
            const dayPlan = nextPlans.find((plan) => plan.date && itemDateKey && plan.date === itemDateKey);
            const normalizedItem = {
                label: String(item?.label || '').trim(),
                cost:
                    item?.cost === 0 || item?.cost
                        ? String(item.cost)
                        : '',
            };
            if (dayPlan) {
                dayPlan.items.push(normalizedItem);
            } else if (nextPlans[0]) {
                nextPlans[0].items.push(normalizedItem);
            }
        }

        return nextPlans.map((plan) => ({
            ...plan,
            items: plan.items.length > 0 ? plan.items : [makeDefaultDayItem()],
        }));
    };

    const openCreateItineraryModal = () => {
        setItineraryFormMode('create');
        setEditingItineraryOptionId(null);
        setItinerarySaveError('');
        setItineraryForm({
            title: '',
            summary: '',
        });
        setItineraryDayPlans(buildTripDayPlans(trip));
        setShowItineraryOptionModal(true);
    };

    const openEditItineraryModal = (option) => {
        setItineraryFormMode('edit');
        setEditingItineraryOptionId(mongoIdString(option?._id));
        setItinerarySaveError('');
        setItineraryForm({
            title: option?.title || '',
            summary: option?.summary || '',
        });
        setItineraryDayPlans(mergeOptionItemsIntoDayPlans(buildTripDayPlans(trip), option));
        setShowItineraryOptionModal(true);
    };

    const handleCloseItineraryModal = () => {
        if (isSavingItineraryOption) return;
        setShowItineraryOptionModal(false);
        setItinerarySaveError('');
    };

    const computedItineraryTotalCost = useMemo(() => {
        return itineraryDayPlans.reduce((total, day) => {
            const dayTotal = (day.items || []).reduce((sum, item) => {
                const n = Number(item.cost);
                return sum + (Number.isFinite(n) ? n : 0);
            }, 0);
            return total + dayTotal;
        }, 0);
    }, [itineraryDayPlans]);

    const buildItineraryItemsFromDayPlans = (dayPlans) => {
        const items = [];
        for (const day of dayPlans) {
            for (const item of day.items || []) {
                const label = String(item?.label || '').trim();
                if (!label) continue;
                const numericCost = Number(item?.cost);
                items.push({
                    type: 'custom',
                    label,
                    date: day.date || null,
                    cost: Number.isFinite(numericCost) ? numericCost : null,
                });
            }
        }
        return items;
    };

    const itineraryLinesForOption = (option) =>
        Array.isArray(option?.items)
            ? option.items
                .filter((item) => String(item?.label || '').trim())
                .map((item) => ({
                    label: String(item?.label || '').trim(),
                    cost: Number.isFinite(Number(item?.cost)) ? Number(item.cost) : null,
                }))
            : [];

    const groupItineraryItemsByDay = (option) => {
        const groups = new Map();
        const items = Array.isArray(option?.items) ? option.items : [];
        for (const item of items) {
            const dateKey = toDateKey(item?.date) || 'No date';
            if (!groups.has(dateKey)) groups.set(dateKey, []);
            groups.get(dateKey).push(item);
        }
        return [...groups.entries()].sort((a, b) => {
            if (a[0] === 'No date') return 1;
            if (b[0] === 'No date') return -1;
            return a[0].localeCompare(b[0]);
        });
    };

    const itineraryVoteSummary = (option) => {
        const reviews = Array.isArray(option?.reviews) ? option.reviews : [];
        return {
            preferred: reviews.filter((r) => r?.value === 'preferred').length,
            acceptable: reviews.filter((r) => r?.value === 'acceptable').length,
            notPreferred: reviews.filter((r) => r?.value === 'not_preferred').length,
        };
    };

    const handleSaveItineraryOption = async (e) => {
        e.preventDefault();
        if (!id || !dbUser?._id) return;
        const title = itineraryForm.title.trim();
        if (!title) {
            setItinerarySaveError('Title is required.');
            return;
        }

        const items = buildItineraryItemsFromDayPlans(itineraryDayPlans);
        if (items.length === 0) {
            setItinerarySaveError('Add at least one itinerary step.');
            return;
        }
        const payload = {
            title,
            summary: itineraryForm.summary.trim(),
            estimatedTotalCost: computedItineraryTotalCost,
            items,
        };

        setItinerarySaveError('');
        setIsSavingItineraryOption(true);
        try {
            if (itineraryFormMode === 'edit' && editingItineraryOptionId) {
                await updateItineraryOption(id, editingItineraryOptionId, payload, mongoIdString(dbUser._id));
            } else {
                await createItineraryOption(id, payload, mongoIdString(dbUser._id));
            }
            await loadItineraryOptionsData();
            setShowItineraryOptionModal(false);
        } catch (err) {
            setItinerarySaveError(
                extractApiErrorMessage(err, 'Could not save itinerary option right now.')
            );
        } finally {
            setIsSavingItineraryOption(false);
        }
    };

    const handleDayItemChange = (dayIdx, itemIdx, field, value) => {
        setItineraryDayPlans((prev) => prev.map((dayPlan, dIdx) => {
            if (dIdx !== dayIdx) return dayPlan;
            const nextItems = (dayPlan.items || []).map((item, iIdx) => (
                iIdx === itemIdx ? { ...item, [field]: value } : item
            ));
            return { ...dayPlan, items: nextItems };
        }));
    };

    const addDayItemRow = (dayIdx) => {
        setItineraryDayPlans((prev) => prev.map((dayPlan, dIdx) => (
            dIdx === dayIdx
                ? { ...dayPlan, items: [...(dayPlan.items || []), makeDefaultDayItem()] }
                : dayPlan
        )));
    };

    const removeDayItemRow = (dayIdx, itemIdx) => {
        setItineraryDayPlans((prev) => prev.map((dayPlan, dIdx) => {
            if (dIdx !== dayIdx) return dayPlan;
            const filtered = (dayPlan.items || []).filter((_, iIdx) => iIdx !== itemIdx);
            return { ...dayPlan, items: filtered.length > 0 ? filtered : [makeDefaultDayItem()] };
        }));
    };

    const getMyOptionVote = (option) => {
        const uid = mongoIdString(dbUser?._id);
        if (!uid || !Array.isArray(option?.reviews)) return '';
        const mine = option.reviews.find((review) => mongoIdString(review?.userId) === uid);
        return mine?.value || '';
    };

    const handleQuickVote = async (option, value) => {
        if (!id || !dbUser?._id || !option?._id) return;
        const optionId = mongoIdString(option._id);
        setVoteError('');
        setVoteSubmittingByOptionId((prev) => ({ ...prev, [optionId]: true }));
        try {
            await reviewItineraryOption(
                id,
                optionId,
                { value },
                mongoIdString(dbUser._id)
            );
            await loadItineraryOptionsData();
        } catch (err) {
            setVoteError(err?.response?.data?.error || 'Could not save your vote right now.');
        } finally {
            setVoteSubmittingByOptionId((prev) => ({ ...prev, [optionId]: false }));
        }
    };

    const itineraryVoteLabel = (value) => {
        switch (value) {
            case 'preferred':
                return 'Preferred';
            case 'acceptable':
                return 'Acceptable';
            case 'not_preferred':
                return 'Not Preferred';
            default:
                return value || '';
        }
    };

    const itineraryCommentThreads = (option) => {
        const reviews = Array.isArray(option?.reviews) ? option.reviews : [];
        const commentReviews = reviews.filter((r) => String(r?.comment || '').trim());
        if (!commentReviews.length) return [];

        const myUid = mongoIdString(dbUser?._id);
        const threadsByUser = new Map();

        for (const review of commentReviews) {
            const userId = mongoIdString(review?.userId);
            const labelFromReview = String(review?.userLabel || '').trim();
            const label =
                labelFromReview ||
                (userId && userId === myUid ? (dbUser?.name || dbUser?.email || 'You') : userId);

            if (!threadsByUser.has(userId)) {
                threadsByUser.set(userId, { userId, userLabel: label, items: [] });
            }

            threadsByUser.get(userId).items.push(review);
        }

        return [...threadsByUser.values()].map((thread) => ({
            ...thread,
            items: thread.items.sort(
                (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
            ),
        }));
    };

    const itineraryCommentsFlat = (option) => {
        const directComments = Array.isArray(option?.comments) ? option.comments : [];
        const commentDocs = directComments
            .filter((c) => String(c?.comment || '').trim())
            .map((c) => ({
                userId: mongoIdString(c?.userId),
                comment: String(c?.comment || ''),
                userLabel: String(c?.userLabel || '').trim(),
                createdAt: c?.createdAt,
            }));

        // Backward-compat: older comments were stored inside `reviews.comment`.
        const reviewComments = Array.isArray(option?.reviews) ? option.reviews : [];
        const fallbackReviewComments = reviewComments
            .filter((r) => String(r?.comment || '').trim())
            .map((r) => ({
                userId: mongoIdString(r?.userId),
                comment: String(r?.comment || ''),
                userLabel: String(r?.userLabel || '').trim(),
                createdAt: r?.createdAt,
            }));

        return [...commentDocs, ...fallbackReviewComments].sort(
            (a, b) =>
                new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
        );
    };

    const handleAddItineraryComment = async () => {
        if (!id || !dbUser?._id || !selectedItineraryOption?._id) return;
        const trimmed = itineraryCommentText.trim();
        if (!trimmed) {
            setItineraryCommentError('Comment cannot be empty.');
            return;
        }

        setItineraryCommentError('');
        setItineraryCommentSubmitting(true);
        try {
            await addItineraryOptionComment(
                id,
                mongoIdString(selectedItineraryOption._id),
                { comment: trimmed },
                mongoIdString(dbUser._id)
            );
            setItineraryCommentText('');
            await loadItineraryOptionsData();
        } catch (err) {
            setItineraryCommentError(err?.response?.data?.error || 'Could not save your comment right now.');
        } finally {
            setItineraryCommentSubmitting(false);
        }
    };

    const openItineraryDetailsModal = (option) => {
        setSelectedItineraryOption(option || null);
        setShowItineraryDetailsModal(Boolean(option));
        setItineraryCommentText('');
        setItineraryCommentError('');
        setItineraryCommentSubmitting(false);
    };

    useEffect(() => {
        if (!showItineraryDetailsModal || !selectedItineraryOption?._id) return;
        const selectedId = mongoIdString(selectedItineraryOption._id);
        const updated = itineraryOptions.find((o) => mongoIdString(o?._id) === selectedId);
        if (updated) setSelectedItineraryOption(updated);
    }, [itineraryOptions, showItineraryDetailsModal]);

    const handleDeleteItineraryOption = async () => {
        if (!id || !dbUser?._id || !itineraryOptionToDelete?._id) return;
        setIsDeletingItineraryOption(true);
        try {
            const deletingId = mongoIdString(itineraryOptionToDelete._id);
            await deleteItineraryOption(
                id,
                mongoIdString(itineraryOptionToDelete._id),
                mongoIdString(dbUser._id)
            );
            setShowDeleteItineraryConfirm(false);
            setItineraryOptionToDelete(null);
            await loadItineraryOptionsData();
            if (mongoIdString(selectedItineraryOption?._id) === deletingId) {
                setShowItineraryDetailsModal(false);
                setSelectedItineraryOption(null);
            }
        } catch (err) {
            setVoteError(err?.response?.data?.error || 'Could not delete itinerary option right now.');
        } finally {
            setIsDeletingItineraryOption(false);
        }
    };

    const invitationActivityText = (inv) => {
        const email = inv.inviteeEmail || 'Unknown';
        const when = new Date(inv.updatedAt || inv.createdAt).toLocaleString();
        const roleLabel = inv.role === 'editor' ? 'Editor' : 'Viewer';
        switch (inv.status) {
            case 'pending':  return `Invitation sent to ${email} (${roleLabel}) — ${when}`;
            case 'accepted': return `${email} accepted the invitation as ${roleLabel} — ${when}`;
            case 'declined': return `${email} declined the invitation — ${when}`;
            case 'revoked':  return `Invitation to ${email} was revoked — ${when}`;
            default:         return `${email} — ${inv.status} — ${when}`;
        }
    };

    const buildGroupSummaryModel = (summary, options = TRANSPORT_MODES) => {
        if (!summary || summary.submissionsCount <= 0) return null;
        const responseCount = summary.submissionsCount;
        const avgForMode = (mode) => (summary.scores[mode] ?? 0) / responseCount;
        const avgScores = options.map((m) => avgForMode(m));
        const minAvg = Math.min(...avgScores);
        const maxAvg = Math.max(...avgScores);
        return { responseCount, avgForMode, maxAvg, avgSpan: maxAvg - minAvg };
    };

    // const sortedRoutes = trip.routes
    //     ? [...trip.routes].sort((a, b) =>
    //         new Date(a.departAt?.$date || a.departAt) - new Date(b.departAt?.$date || b.departAt))
    //     : [];

    // memorize sorted routes, only re-sort if routes array changes
    const sortedRoutes = useMemo(() => {
        if (!trip?.routes) return [];
        
        return [...trip.routes].sort((a, b) => {
            const dateA = new Date(a.departAt?.$date || a.departAt);
            const dateB = new Date(b.departAt?.$date || b.departAt);
            return dateA - dateB;
        });
    }, [trip?.routes]);

    const timelineItems = useMemo(() => {
        // format routes
        const routeItems = (sortedRoutes || []).map(route => ({
            ...route,
            itemType: 'route',
            sortDate: new Date(route.departAt?.$date || route.departAt)
        }));

        // format accommodations
        const accItems = (accommodations || []).flatMap(acc => {
            const cleanDate = (dateStr) => dateStr ? dateStr.split('T')[0] : null; // take only the YYYY-MM-DD part of the string
            const cleanTime = (timeStr) => timeStr || '00:00';

            const dateIn = cleanDate(acc.checkInDate);
            const dateOut = cleanDate(acc.checkOutDate);

            return [
                {
                    ...acc,
                    itemType: 'accommodation-checkin',
                    sortDate: dateIn ? new Date(`${dateIn}T${cleanTime(acc.checkInTime)}:00`) : new Date() // force into UTC date
                },
                {
                    ...acc,
                    itemType: 'accommodation-checkout',
                    sortDate: dateOut ? new Date(`${dateOut}T${cleanTime(acc.checkOutTime)}:00`) : new Date() // force into UTC date
                }
            ];
        });

        const activityItems = (activities || []).flatMap(activity => {
            const cleanDate = (dateStr) => dateStr ? dateStr.split('T')[0] : null;
            const cleanTime = (timeStr) => timeStr || '00:00';
            return [ {
                ...activity,
                itemType: 'activity',
                sortDate: new Date(`${cleanDate(activity.activityDate)}T${cleanTime(activity.startTime)}:00`)
            }];
        });

        return [...routeItems, ...accItems, ...activityItems].sort((a, b) => a.sortDate - b.sortDate);
    }, [sortedRoutes, accommodations, activities]);

    // ── helpers for rendering ───────────────────────────────────────────────────────────────
    const renderRouteCard = (route, index, isSameDay, currentDate) => {
        const outOfRange = isRouteOutOfRange({ departAt: route.sortDate });

        return (
            <div key={`route-${route._id}-${index}`} className={`td-timeline-entry${isSameDay ? ' same-day' : ''}`}>
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
                    </div>
                </div>
            </div>
        );
    };

    const renderAccommodationCard = (acc, index, isSameDay, currentDate) => {
        const isCheckIn = acc.itemType === 'accommodation-checkin';
        const outOfRange = isRouteOutOfRange({ departAt: acc.sortDate });

        return (
            <div key={`acc-${acc._id}-${acc.itemType}`} className={`td-timeline-entry${isSameDay ? ' same-day' : ''}`}>
                <div className="td-timeline-date-circle">
                    {!isSameDay ? currentDate : ''}
                </div>

                <div className={`td-route-card td-acc-card ${outOfRange ? 'td-route-card--warning' : ''}`}>
                    <div className="td-route-info">
                        <div className="td-acc-badge-row">
                            {outOfRange && <span>⚠️ </span>}
                            <span className="td-acc-type-badge">{acc.type}</span>
                        </div>
                        <h3>
                            {isCheckIn ? '🏨 Check-in: ' : '🏨 Check-out: '}
                            {acc.name}
                        </h3>
                        <p>🕒 {isCheckIn ? `Check-in starts: ${acc.checkInTime}` : `Check-out by: ${acc.checkOutTime}`}</p>
                    </div>
                    <div className="td-route-actions">
                        <button
                            className="td-btn-view"
                            onClick={() => handleOpenAccModal(acc)}
                        >
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderActivityCard = (activity, index, isSameDay, currentDate) => {
        const outOfRange = isRouteOutOfRange({ departAt: activity.sortDate });

        return (
            <div key={`activity-${activity._id}`} className={`td-timeline-entry${isSameDay ? ' same-day' : ''}`}>
                <div className="td-timeline-date-circle">
                    {!isSameDay ? currentDate : ''}
                </div>

                <div className={`td-route-card td-activity-card ${outOfRange ? 'td-route-card--warning' : ''}`}>
                    <div className="td-route-info">
                        {outOfRange && <span>⚠️ </span>}
                        <span className="td-acc-type-badge">{activity.activityType}</span>
                        <h3>🎯 {activity.name}</h3>
                        <p>🕒 {activity.startTime.split(':')[0] > 12 ? activity.startTime.split(':')[0] - 12 + ":" + activity.startTime.split(':')[1] + " PM " : activity.startTime + " AM "}
                            to {activity.endTime.split(':')[0] > 12 ? activity.endTime.split(':')[0] - 12 + ":" + activity.endTime.split(':')[1] + " PM" : activity.endTime + " AM"}
                            </p>
                    </div>
                    <div className="td-route-actions">
                        <button
                            className="td-btn-view"
                            onClick={() => handleOpenActivityModal(activity)}
                        >
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── rendering ───────────────────────────────────────────────────────────────

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
        if (!trip || !hasCollaboratorsOnTrip(trip)) return null;
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
                        Transport group summary
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

    const renderCategorySummary = (title, summary, categories, labelForCategory) => {
        const submissionsCount = summary?.submissionsCount || 0;
        const tied = summary?.tiedCategories || [];
        const topCategory = summary?.topCategory;
        const model = summary ? buildGroupSummaryModel(summary, categories) : null;
        const summaryMeta = model
            ? (() => {
                const n = model.responseCount;
                const nLabel = `${n} ${n === 1 ? 'response' : 'responses'}`;
                if (tied.length > 1) {
                    return `${nLabel} · Tie: ${tied.map((c) => labelForCategory(c)).join(', ')}`;
                }
                return `${nLabel} · Top: ${labelForCategory(topCategory)}`;
            })()
            : 'No responses yet';
        const detailsKey = `${title}-${submissionsCount}-${topCategory || 'none'}`;
        return (
            <details key={detailsKey} className="trip-route-preference-group-details" defaultOpen>
                <summary className="trip-route-preference-group-summary">
                    <span className="trip-route-preference-group-summary-title">
                        <span className="trip-route-preference-group-chevron" aria-hidden>▼</span>
                        {title}
                    </span>
                    <span className="trip-route-preference-group-summary-meta">{summaryMeta}</span>
                </summary>
                <div className="trip-route-preference-group-body">
                    {model && summary ? (
                        <div className="group-transport-bars" role="list">
                            {[...categories]
                                .sort((a, b) => {
                                    const da = model.avgForMode(a);
                                    const db = model.avgForMode(b);
                                    if (da !== db) return da - db;
                                    return labelForCategory(a).localeCompare(labelForCategory(b));
                                })
                                .map((category) => {
                                    const avg = model.avgForMode(category);
                                    const pct = model.avgSpan === 0 ? 100 : Math.round((100 * (model.maxAvg - avg)) / model.avgSpan);
                                    const isTopPick = (summary.tiedCategories || []).includes(category);
                                    return (
                                        <div key={category} className="group-transport-bar-row" role="listitem">
                                            <span className="group-transport-bar-label">{labelForCategory(category)}</span>
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
                    ) : (
                        <div className="group-transport-bars group-transport-bars--empty" role="list">
                            {categories.map((category) => (
                                <div key={category} className="group-transport-bar-row" role="listitem">
                                    <span className="group-transport-bar-label">{labelForCategory(category)}</span>
                                    <div className="group-transport-bar-track" aria-hidden="true">
                                        <div className="group-transport-bar-fill group-transport-bar-fill--empty" style={{ width: '0%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </details>
        );
    };

    const renderPackingList = () => {
        const canPack = canEditTripAsUser(trip, dbUser?._id);
        return (
        <div className="td-tab-content">
          <div className="td-content-header">
            <h2>Packing List</h2>
            <span className="td-packing-count">
              {packingItems.filter((i) => i.checked).length}/{packingItems.length} packed
            </span>
          </div>

          {canPack && (
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
          )}

          {packingItems.length === 0 ? (
            <div className="td-empty-state">
              <span className="td-empty-icon">✓</span>
              <p>{canPack ? 'No items yet. Add something above.' : 'No packing items yet.'}</p>
            </div>
          ) : (
            <ul className="td-packing-list">
              {packingItems.map((item) => (
                <li key={item.id} className={`td-packing-item${item.checked ? ' td-packing-item--checked' : ''}`}>
                  {canPack ? (
                    <input
                      type="checkbox"
                      className="td-packing-checkbox"
                      checked={item.checked}
                      onChange={() => handleTogglePackingItem(item.id)}
                      aria-label={`Mark ${item.text} as ${item.checked ? 'unpacked' : 'packed'}`}
                    />
                  ) : (
                    <span className="td-packing-checkbox-static" aria-hidden>{item.checked ? '☑' : '☐'}</span>
                  )}

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
                      <button type="button" className="td-packing-save-btn" onClick={() => handleSaveEditPackingItem(item.id)}>Save</button>
                      <button type="button" className="td-packing-cancel-btn" onClick={handleCancelEditPackingItem}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="td-packing-item-text">{item.text}</span>
                      {canPack && (
                        <>
                          <button type="button" className="td-packing-edit-btn" onClick={() => handleStartEditPackingItem(item)}>Edit</button>
                          <button type="button" className="td-packing-delete-btn" onClick={() => handleDeletePackingItem(item.id)}>Delete</button>
                        </>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        );
    };

    const handleExportPDF = async () => {
        if (!timelineRef.current || !packingRef.current) return;
    
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
    
        const renderSection = async (element) => {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
            });
            return canvas;
        };
    
        const addCanvasToPdf = (canvas, isFirstPage) => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
            let yOffset = 0;
            let remainingHeight = imgHeight;
            let firstSlice = true;
    
            if (!isFirstPage) pdf.addPage();
    
            while (remainingHeight > 0) {
                if (!firstSlice) pdf.addPage();
    
                const sliceHeight = Math.min(remainingHeight, pageHeight - 30);                
                const sourceY = (yOffset / imgHeight) * canvas.height;
                const sourceHeight = (sliceHeight / imgHeight) * canvas.height;
    
                // Create a slice canvas
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sourceHeight;
                const ctx = sliceCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
    
                pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, sliceHeight);
    
                yOffset += sliceHeight;
                remainingHeight -= sliceHeight;
                firstSlice = false;
            }
        };
    
        const timelineCanvas = await renderSection(timelineRef.current);
        addCanvasToPdf(timelineCanvas, true);
    
        const packingCanvas = await renderSection(packingRef.current);
        addCanvasToPdf(packingCanvas, false);
    
        pdf.save(`${trip.name}-trip.pdf`);
    };

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

    const currentTotal = trip.totalCost || 0;
    // const currentTotal = (trip.routes && accommodations && activities) ? calculateTotalCost(trip.routes, activities, accommodations) : 0;
    // moved sortedRoutes up to a useMemo, so it doesn't need to be re-calculated on every render
    // const sortedRoutes = trip.routes
    //     ? [...trip.routes].sort((a, b) =>
    //         new Date(a.departAt?.$date || a.departAt) - new Date(b.departAt?.$date || b.departAt))
    //     : [];

    const tripIdStr = mongoIdString(trip._id);
    const tripRole = tripRoleForUser(trip, dbUser?._id);
    const isTripOwner = tripRole === 'owner';
    const canEditTripPage = canEditTripAsUser(trip, dbUser?._id);
    const isTripCollaborator = tripRole === 'viewer' || tripRole === 'editor';
    const hasCollaborators = hasCollaboratorsOnTrip(trip);

    const renderTimelineMult = () => {
        if (timelineItems.length === 0) {
            return (
                <div className="td-tab-content">
                    <div className="td-empty-state">
                        <span className="td-empty-icon">◈</span>
                        <p>Your timeline is empty!</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="td-tab-content">
                <div className="td-content-header">
                    <h2>Timeline</h2>
                </div>

                <div className="td-timeline">
                    {timelineItems.map((item, index) => {
                        const currentDate = formatDate(item.sortDate);
                        const previousDate = index > 0 ? formatDate(timelineItems[index - 1].sortDate) : null;
                        const isSameDay = currentDate === previousDate;

                        // TODO: add other timeline items such as activities
                        switch (item.itemType) {
                            case 'route':
                                return renderRouteCard(item, index, isSameDay, currentDate);
                            
                            case 'accommodation-checkin':
                            case 'accommodation-checkout':
                                return renderAccommodationCard(item, index, isSameDay, currentDate);
                            case 'activity':
                                return renderActivityCard(item, index, isSameDay, currentDate);
                            
                            default:
                                return null;
                        }
                    })}
                </div>
            </div>
        );
    };

    /* original renderTimeline function before adding accommodations and timelineItems */
    // const renderTimeline = () => (
    //     <div className="td-tab-content">
    //         <div className="td-content-header">
    //             <h2>Timeline</h2>
    //             {hasCollaborators && (
    //                 <button
    //                     type="button"
    //                     className="trip-route-preference-open"
    //                     onClick={() => { setPreferenceError(''); setShowPreferencesModal(true); }}
    //                 >
    //                     Group Transport Preferences
    //                 </button>
    //             )}
    //         </div>
    //         {sortedRoutes.length === 0 ? (
    //             <div className="td-empty-state">
    //                 <span className="td-empty-icon">◈</span>
    //                 <p>No routes added to this trip yet.</p>
    //             </div>
    //         ) : (
    //             <div className="td-timeline">
    //                 {sortedRoutes.map((route, index) => {
    //                     const currentDate = formatDate(route.departAt);
    //                     const previousDate = index > 0 ? formatDate(sortedRoutes[index - 1].departAt) : null;
    //                     const isSameDay = currentDate === previousDate;
    //                     const outOfRange = isRouteOutOfRange(route);

    //                     return (
    //                         <div key={index} className={`td-timeline-entry${isSameDay ? ' same-day' : ''}`}>
    //                             <div className="td-timeline-date-circle">
    //                                 {!isSameDay ? currentDate : ''}
    //                             </div>

    //                             <div className={`td-route-card ${outOfRange ? 'td-route-card--warning' : ''}`}>
    //                                 <div className="td-route-info">
    //                                     <h3>
    //                                         {outOfRange && <span title="Outside trip dates">⚠️ </span>}
    //                                         {getRouteTitle(route)}
    //                                     </h3>
    //                                     <p>{getRouteMetaLine(route)}</p>
    //                                     <p>{getRouteTimeLine(route)}</p>
    //                                 </div>

    //                                 <div className="td-route-actions">
    //                                     <button
    //                                         className="td-btn-view"
    //                                         onClick={() => navigate('/view-route-details', {
    //                                             state: { selectedRoute: route, fromTripDetails: true, tripId: trip._id }
    //                                         })}
    //                                     >
    //                                         View Details
    //                                     </button>
    //                                     {isTripOwner && (
    //                                         <button
    //                                             className="td-btn-delete"
    //                                             onClick={() => { setRouteToDelete(route); setShowConfirm(true); }}
    //                                         >
    //                                             Delete Route
    //                                         </button>
    //                                     )}
    //                                 </div>
    //                             </div>
    //                         </div>
    //                     );
    //                 })}
    //             </div>
    //         )}
    //     </div>
    // );

    const renderRoutes = () => (
        <div className="td-tab-content">
            <div className="td-content-header">
                <h2>Routes</h2>
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
                                    {/* HERE FOR ROUTE DATE */}
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
                                    {canEditTripPage && (
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

    const renderAccommodations = () => (
        <AccommodationsTab
            tripId={id}
            accommodations={accommodations}
            canEdit={canEditTripPage}
            tripDates={{ start: trip?.startDate, end: trip?.endDate }}
            onOpenModal={handleOpenAccModal}
            onDelete={handleDeleteAcc}
        />
    );

    const renderActivities = () => (
        <ActivitiesTab
            tripId={id}
            activities={activities}
            canEdit={canEditTripPage}
            tripDates={{ start: trip?.startDate, end: trip?.endDate }}
            onOpenModal={handleOpenActivityModal}
            onDelete={handleDeleteActivity}
        />
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

    const renderMap = () => (
        <div className="td-tab-content">
            <div className="td-content-header"><h2>Map</h2></div>
            {sortedRoutes.length === 0 ? (
                <div className="td-empty-state">
                    <span className="td-empty-icon">◎</span>
                    <p>No routes added to this trip yet.</p>
                </div>
            ) : (
                <div className="td-map-panel">
                    <div className="td-map-summary">
                        <h3>Trip Route Map</h3>
                        <p>
                            Showing {sortedRoutes.length} {sortedRoutes.length === 1 ? 'route' : 'routes'} as direct point-to-point connections.
                        </p>
                    </div>
                    <RouteMap routes={sortedRoutes} />
                    <ul className="td-map-route-list" aria-label="Mapped routes">
                        {sortedRoutes.map((route, index) => (
                            <li key={`map-route-${mongoIdString(route._id) || index}`}>
                                {getRouteTitle(route)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );

    const renderItineraryOptions = () => {
        if (!hasCollaborators) {
            return (
                <div className="td-tab-content">
                    <div className="td-content-header"><h2>Itinerary Options</h2></div>
                    <div className="td-empty-state">
                        <span className="td-empty-icon">☰</span>
                        <p>Itinerary options are only available on collaborative trips.</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="td-tab-content">
                <div className="td-content-header">
                    <h2>Itinerary Options</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            className="trip-route-preference-open"
                            onClick={() => { setPreferenceError(''); setShowPreferencesModal(true); }}
                        >
                            Group Preferences
                        </button>
                        {canEditTripPage && (
                            <button
                                type="button"
                                className="trip-route-preference-open"
                                onClick={openCreateItineraryModal}
                            >
                                Add Option
                            </button>
                        )}
                    </div>
                </div>
                {isLoadingItineraryOptions ? (
                    <p>Loading itinerary options...</p>
                ) : itineraryOptionsError ? (
                    <p className="td-invite-error" role="alert">{itineraryOptionsError}</p>
                ) : itineraryOptions.length === 0 ? (
                    <div className="td-empty-state">
                        <span className="td-empty-icon">☰</span>
                        <p>No itinerary options available yet.</p>
                    </div>
                ) : (
                    <div className="td-routes-list itinerary-options-list">
                        {itineraryOptions.map((option) => (
                            <article key={mongoIdString(option._id)} className="acc-card itinerary-option-card">
                                <div className="acc-col acc-col-main itinerary-option-main-col">
                                    <span className="acc-type-tag itinerary-option-type-tag">
                                        ITINERARY
                                    </span>
                                    <div className="acc-header-row">
                                        <h3 className="itinerary-option-title">{option.title || 'Untitled option'}</h3>
                                    </div>
                                    <p className="acc-address itinerary-option-summary">
                                        {option.summary || 'No summary provided.'}
                                    </p>
                                </div>

                                <div className="acc-col acc-col-meta itinerary-option-meta-col">
                                    <div className="acc-meta-item itinerary-option-meta-item">
                                        <span>Total Cost</span>
                                        <strong>${Number(option.estimatedTotalCost || 0).toFixed(2)}</strong>
                                    </div>
                                </div>

                                <div className="acc-col acc-col-votes itinerary-option-votes-col">
                                    {(() => {
                                        const votes = itineraryVoteSummary(option);
                                        const total = votes.preferred + votes.acceptable + votes.notPreferred;
                                        const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
                                        if (total === 0) {
                                            return (
                                                <div className="itinerary-vote-bars">
                                                    <div className="itinerary-vote-empty">No votes yet</div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="itinerary-vote-bars">
                                                <div className="itinerary-vote-bar-row itinerary-vote-bar-row--preferred">
                                                    <span className="itinerary-vote-bar-label">Preferred</span>
                                                    <span className="itinerary-vote-bar-count">{votes.preferred}</span>
                                                    <div className="itinerary-vote-bar-track" aria-hidden="true">
                                                        <div className="itinerary-vote-bar-fill" style={{ width: `${pct(votes.preferred)}%` }} />
                                                    </div>
                                                </div>
                                                <div className="itinerary-vote-bar-row itinerary-vote-bar-row--acceptable">
                                                    <span className="itinerary-vote-bar-label">Acceptable</span>
                                                    <span className="itinerary-vote-bar-count">{votes.acceptable}</span>
                                                    <div className="itinerary-vote-bar-track" aria-hidden="true">
                                                        <div className="itinerary-vote-bar-fill" style={{ width: `${pct(votes.acceptable)}%` }} />
                                                    </div>
                                                </div>
                                                <div className="itinerary-vote-bar-row itinerary-vote-bar-row--not-preferred">
                                                    <span className="itinerary-vote-bar-label">Not Preferred</span>
                                                    <span className="itinerary-vote-bar-count">{votes.notPreferred}</span>
                                                    <div className="itinerary-vote-bar-track" aria-hidden="true">
                                                        <div className="itinerary-vote-bar-fill" style={{ width: `${pct(votes.notPreferred)}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="acc-col acc-col-actions itinerary-option-actions-col">
                                    <div className="acc-menu-container">
                                        <button
                                            className="acc-menu-trigger"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const oid = mongoIdString(option._id);
                                                setItineraryActiveMenuId((prev) => (prev === oid ? null : oid));
                                            }}
                                        >
                                            ⋮
                                        </button>
                                        {itineraryActiveMenuId === mongoIdString(option._id) && (
                                            <div className="acc-dropdown">
                                                <button
                                                    onClick={() => {
                                                        setItineraryActiveMenuId(null);
                                                        openItineraryDetailsModal(option);
                                                    }}
                                                >
                                                    View Details
                                                </button>
                                                {canEditTripPage && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setItineraryActiveMenuId(null);
                                                                openEditItineraryModal(option);
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            className="delete-option"
                                                            onClick={() => {
                                                                setItineraryActiveMenuId(null);
                                                                setItineraryOptionToDelete(option);
                                                                setShowDeleteItineraryConfirm(true);
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
                {voteError && <p className="td-invite-error" role="alert">{voteError}</p>}
            </div>
        );
    };

    const renderCollaboration = () => (
        <div className="td-tab-content">
            <div className="td-content-header"><h2>Collaboration</h2></div>

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
                        <label htmlFor="invite-role" className="visually-hidden">Access level</label>
                        <select
                            id="invite-role"
                            className="td-invite-role"
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            disabled={inviteSending}
                            aria-label="Collaborator access level"
                        >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                        </select>
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
                    <p>
                        {tripRole === 'viewer'
                            ? 'You’re a viewer on this trip — you can browse and join group preferences, but only editors can change trip details.'
                            : 'You’re an editor on this trip — you can edit routes, accommodations, and trip details. Only the owner can invite others or delete the trip.'}
                    </p>
                </div>
            )}
        </div>
    );

    const renderChangelog = () => (
        <TripChangelog
            changelog={changelog}
            loading={changelogLoading}
            error={changelogError}
            canRollback={canEditTripPage}
            rollbackMessage={rollbackMessage}
            onRollbackRequest={(version) => {
                setRollbackError('');
                setRollbackMessage('');
                setRollbackTarget(version);
            }}
        />
    );

    const tabContent = {
        timeline:       renderTimelineMult,
        routes:         renderRoutes,
        itineraryoptions: renderItineraryOptions,
        accommodations: renderAccommodations,
        activities:     renderActivities,
        map:            renderMap,
        collaboration:  renderCollaboration,
        changelog:      renderChangelog,
        packinglist:    renderPackingList,
    };

    // ── render ────────────────────────────────────────────────────────────────

    const visibleTabs = hasCollaborators
        ? TABS
        : TABS.filter((tab) => tab.id !== 'itineraryoptions');

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
                            {canEditTripPage && (
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
                                            onClick={() => navigate(`/add-accommodation/${trip._id}`, { state: { tripId: trip._id } })}
                                        >
                                            Add Accommodation
                                        </button>
                                        <button
                                            className="td-dropdown-item"
                                            onClick={() => navigate(`/add-activity/${trip._id}`, { state: { tripId: trip._id } })}
                                        >
                                            Add Activity
                                        </button>
                                    </div>
                                )}
                            </div>
                            )}
                            {canEditTripPage && (
                                <button
                                    className="td-sidebar-action-btn td-sidebar-action-btn--outline"
                                    type="button"
                                    onClick={() => navigate(`/edit-trip/${id}`)}
                                >
                                    <span className="td-sidebar-action-icon">✎</span>
                                    <span>Edit Trip</span>
                                </button>
                            )}
                            {isTripOwner && (
                                <button
                                    className="td-sidebar-action-btn td-sidebar-action-btn--outline"
                                    type="button"
                                    onClick={() => setActiveTab('collaboration')}
                                >
                                    <span className="td-sidebar-action-icon">✉</span>
                                    <span>Invite Friends</span>
                                </button>
                            )}
                            {(isTripOwner || isTripCollaborator) && (
                                <button
                                    className="td-sidebar-action-btn td-sidebar-action-btn--outline"
                                    type="button"
                                    onClick={handleSidebarDuplicate}
                                    disabled={sidebarDuplicating || sidebarLeaving}
                                >
                                    <span className="td-sidebar-action-icon">⎘</span>
                                    <span>{sidebarDuplicating ? 'Duplicating…' : 'Duplicate Trip'}</span>
                                </button>
                            )}
                            {isTripCollaborator && (
                                <button
                                    className="td-sidebar-action-btn td-sidebar-action-btn--outline td-sidebar-action-btn--danger"
                                    type="button"
                                    onClick={handleLeaveTrip}
                                    disabled={sidebarLeaving || sidebarDuplicating}
                                >
                                    <span className="td-sidebar-action-icon">⊘</span>
                                    <span>{sidebarLeaving ? 'Removing…' : 'Remove'}</span>
                                </button>
                            )}
                            <button
                                className="td-sidebar-action-btn td-sidebar-action-btn--outline"
                                type="button"
                                onClick={handleExportPDF}
                            >
                                <span className="td-sidebar-action-icon">📄</span>
                                <span>Export Trip</span>
                            </button>
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
                    {tripRole && tripRole !== 'owner' && (
                        <p className="td-trip-role-line">
                            You’re a <strong>{tripRole === 'editor' ? 'editor' : 'viewer'}</strong> on this trip
                        </p>
                    )}
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

            {rollbackTarget && (
                <div className="td-modal-overlay" onClick={() => !rollbackSaving && setRollbackTarget(null)}>
                    <div className="td-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Confirm Rollback</h3>
                        <p>
                            Restore "{rollbackTarget.snapshotBefore?.name || 'this trip'}" from before{' '}
                            "{rollbackTarget.summary || 'the selected change'}"?
                        </p>
                        {rollbackError && <p className="td-invite-error" role="alert">{rollbackError}</p>}
                        <div className="td-modal-actions">
                            <button
                                className="td-modal-btn td-modal-btn--danger"
                                onClick={handleRollbackTrip}
                                disabled={rollbackSaving}
                            >
                                {rollbackSaving ? 'Restoring...' : 'Confirm'}
                            </button>
                            <button
                                className="td-modal-btn td-modal-btn--cancel"
                                onClick={() => setRollbackTarget(null)}
                                disabled={rollbackSaving}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Group Preferences Modal ── */}
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
                            <h2>Group Preferences</h2>
                            {isLoadingPreferenceData && <p>Loading...</p>}
                        </div>
                        <p className="trip-route-preference-help">
                            Rank each category from highest to lowest preference.
                        </p>
                        <section className="trip-route-preference-section">
                            <h3 className="trip-route-preference-section-title">Transport Mode</h3>
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
                        </section>
                        <section className="trip-route-preference-section">
                            <h3 className="trip-route-preference-section-title">Accommodation Type</h3>
                            <ol className="trip-route-preference-list">
                                {ACCOMMODATION_CATEGORIES.map((category) => (
                                    <li key={category} className="trip-route-preference-item">
                                        <div className="trip-route-preference-buttons">
                                            <label htmlFor={`rank-accommodation-${category}`} className="visually-hidden">
                                                Rank for {accommodationCategoryLabel(category)}
                                            </label>
                                            <select
                                                id={`rank-accommodation-${category}`}
                                                value={accommodationRankByCategory[category]}
                                                onChange={(e) =>
                                                    handleCategoryRankSelectChange(
                                                        setAccommodationRankByCategory,
                                                        ACCOMMODATION_CATEGORIES,
                                                        category,
                                                        e.target.value
                                                    )
                                                }
                                                disabled={isSavingPreference}
                                            >
                                                <option value="">--</option>
                                                {[1, 2, 3, 4].map((rank) => (
                                                    <option key={`${category}-${rank}`} value={rank}>{rank}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <span>{accommodationCategoryLabel(category)}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                        <section className="trip-route-preference-section">
                            <h3 className="trip-route-preference-section-title">Activity Type</h3>
                            <ol className="trip-route-preference-list">
                                {ACTIVITY_CATEGORIES.map((category) => (
                                    <li key={category} className="trip-route-preference-item">
                                        <div className="trip-route-preference-buttons">
                                            <label htmlFor={`rank-activity-${category}`} className="visually-hidden">
                                                Rank for {activityCategoryLabel(category)}
                                            </label>
                                            <select
                                                id={`rank-activity-${category}`}
                                                value={activityRankByCategory[category]}
                                                onChange={(e) =>
                                                    handleCategoryRankSelectChange(
                                                        setActivityRankByCategory,
                                                        ACTIVITY_CATEGORIES,
                                                        category,
                                                        e.target.value
                                                    )
                                                }
                                                disabled={isSavingPreference}
                                            >
                                                <option value="">--</option>
                                                {[1, 2, 3, 4, 5, 6].map((rank) => (
                                                    <option key={`${category}-${rank}`} value={rank}>{rank}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <span>{activityCategoryLabel(category)}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                        <div className="trip-route-preference-modal-actions">
                            <button
                                type="button"
                                className="trip-route-preference-save"
                                onClick={handleSavePreferences}
                                disabled={isSavingPreference || isLoadingPreferenceData}
                            >
                                {isSavingPreference ? 'Saving...' : 'Save Group Preferences'}
                            </button>
                        </div>
                        {renderModalGroupSummary()}
                        {renderCategorySummary(
                            'Accommodation group summary',
                            groupCategorySummary?.accommodation,
                            ACCOMMODATION_CATEGORIES,
                            accommodationCategoryLabel
                        )}
                        {renderCategorySummary(
                            'Activity group summary',
                            groupCategorySummary?.activity,
                            ACTIVITY_CATEGORIES,
                            activityCategoryLabel
                        )}
                        {preferenceError && <p className="trip-route-preference-error">{preferenceError}</p>}
                    </section>
                </div>
            )}

            {/* Group Options */}
            {hasCollaborators && showItineraryOptionModal && (
                <div className="td-modal-overlay" onClick={handleCloseItineraryModal}>
                    <div className="td-modal itinerary-option-modal" style={{ width: 'min(560px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
                        <h3>{itineraryFormMode === 'edit' ? 'Edit Itinerary Option' : 'Add Itinerary Option'}</h3>
                        <form onSubmit={handleSaveItineraryOption} className="itinerary-option-form">
                            <div className="itinerary-option-fields" style={{ display: 'grid', gap: '10px', textAlign: 'left' }}>
                                <label htmlFor="itinerary-option-title">
                                    Title
                                    <input
                                        id="itinerary-option-title"
                                        type="text"
                                        value={itineraryForm.title}
                                        onChange={(e) =>
                                            setItineraryForm((prev) => ({ ...prev, title: e.target.value }))
                                        }
                                        disabled={isSavingItineraryOption}
                                        style={{ width: '100%' }}
                                    />
                                </label>
                                <label htmlFor="itinerary-option-summary">
                                    Summary
                                    <textarea
                                        id="itinerary-option-summary"
                                        value={itineraryForm.summary}
                                        onChange={(e) =>
                                            setItineraryForm((prev) => ({ ...prev, summary: e.target.value }))
                                        }
                                        disabled={isSavingItineraryOption}
                                        rows={2}
                                        style={{ width: '100%' }}
                                    />
                                </label>
                                <div>
                                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Daily Itinerary Plan</p>
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        {itineraryDayPlans.map((dayPlan, dayIdx) => (
                                            <details
                                                key={dayPlan.key}
                                                open={dayIdx === 0}
                                                style={{ border: '1px solid var(--td-border-mid)', borderRadius: '8px', padding: '10px 12px' }}
                                            >
                                                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                                                    <span>{dayPlan.label}</span>
                                                    {dayPlan.date && (
                                                        <span style={{ color: 'var(--td-text-muted)', fontWeight: 500 }}>
                                                            {' \u00b7 '}
                                                            {new Date(`${dayPlan.date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                                                        </span>
                                                    )}
                                                    <span style={{ color: 'var(--td-text-muted)', fontWeight: 500 }}>
                                                        {' \u00b7 '}
                                                        {(dayPlan.items || []).filter((item) => String(item?.label || '').trim()).length} item
                                                        {(dayPlan.items || []).filter((item) => String(item?.label || '').trim()).length === 1 ? '' : 's'}
                                                    </span>
                                                </summary>
                                                <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                                                    {(dayPlan.items || []).map((item, itemIdx) => (
                                                        <div
                                                            key={`${dayPlan.key}-item-${itemIdx}`}
                                                            style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: '8px', alignItems: 'center' }}
                                                        >
                                                            <input
                                                                type="text"
                                                                placeholder="Itinerary step (e.g., Train to Boston)"
                                                                value={item.label}
                                                                onChange={(e) =>
                                                                    handleDayItemChange(dayIdx, itemIdx, 'label', e.target.value)
                                                                }
                                                                disabled={isSavingItineraryOption}
                                                            />
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                placeholder="Cost"
                                                                value={item.cost}
                                                                onChange={(e) =>
                                                                    handleDayItemChange(dayIdx, itemIdx, 'cost', e.target.value)
                                                                }
                                                                disabled={isSavingItineraryOption}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="td-modal-btn td-modal-btn--cancel"
                                                                onClick={() => removeDayItemRow(dayIdx, itemIdx)}
                                                                disabled={isSavingItineraryOption}
                                                                style={{ padding: '8px 10px' }}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <div>
                                                        <button
                                                            type="button"
                                                            className="td-btn-view"
                                                            onClick={() => addDayItemRow(dayIdx)}
                                                            disabled={isSavingItineraryOption}
                                                        >
                                                            + Add item
                                                        </button>
                                                    </div>
                                                </div>
                                            </details>
                                        ))}
                                    </div>
                                </div>
                                <label htmlFor="itinerary-option-total" className="itinerary-option-total">
                                    Estimated Total Cost (auto-calculated)
                                    <input
                                        id="itinerary-option-total"
                                        type="text"
                                        value={`$${computedItineraryTotalCost.toFixed(2)}`}
                                        disabled
                                        readOnly
                                        style={{ width: '100%', backgroundColor: '#f8fafc' }}
                                    />
                                </label>
                            </div>
                            {itinerarySaveError && (
                                <p className="td-invite-error" role="alert" style={{ marginTop: '10px' }}>
                                    {itinerarySaveError}
                                </p>
                            )}
                            <div className="td-modal-actions itinerary-option-actions">
                                <div className="itinerary-option-action-row">
                                <button
                                    type="button"
                                    className="td-modal-btn td-modal-btn--cancel"
                                    onClick={handleCloseItineraryModal}
                                    disabled={isSavingItineraryOption}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="trip-route-preference-save"
                                    disabled={isSavingItineraryOption}
                                >
                                    {isSavingItineraryOption
                                        ? 'Saving...'
                                        : itineraryFormMode === 'edit'
                                            ? 'Save Changes'
                                            : 'Create Option'}
                                </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showItineraryDetailsModal && selectedItineraryOption && (
                <div className="td-modal-overlay" onClick={() => setShowItineraryDetailsModal(false)}>
                    <div className="td-modal itinerary-option-details-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{selectedItineraryOption.title || 'Itinerary Option'}</h3>
                        <p className="itinerary-option-details-summary">
                            {selectedItineraryOption.summary || 'No summary provided.'}
                        </p>
                        <div className="itinerary-option-details-top">
                            <span><strong>Total Cost:</strong> ${Number(selectedItineraryOption.estimatedTotalCost || 0).toFixed(2)}</span>
                        </div>
                        <div className="itinerary-option-vote-summary">
                            <span>Preferred: {itineraryVoteSummary(selectedItineraryOption).preferred}</span>
                            <span>Acceptable: {itineraryVoteSummary(selectedItineraryOption).acceptable}</span>
                            <span>Not Preferred: {itineraryVoteSummary(selectedItineraryOption).notPreferred}</span>
                        </div>
                        <div className="itinerary-details-vote-controls">
                            {[
                                { key: 'preferred', label: 'Preferred' },
                                { key: 'acceptable', label: 'Acceptable' },
                                { key: 'not_preferred', label: 'Not Preferred' },
                            ].map((vote) => (
                                <button
                                    key={vote.key}
                                    type="button"
                                    className="itinerary-details-vote-btn"
                                    style={
                                        getMyOptionVote(selectedItineraryOption) === vote.key
                                            ? { backgroundColor: 'var(--td-accent)', color: '#fff', borderColor: 'var(--td-accent)' }
                                            : undefined
                                    }
                                    onClick={() => handleQuickVote(selectedItineraryOption, vote.key)}
                                    disabled={Boolean(voteSubmittingByOptionId[mongoIdString(selectedItineraryOption._id)])}
                                >
                                    {vote.label}
                                </button>
                            ))}
                        </div>

                        <div className="itinerary-option-details-body">
                            {(() => {
                                const tripDayPlans = trip ? buildTripDayPlans(trip) : [];
                                const dayNumByDateKey = new Map();
                                tripDayPlans.forEach((p, idx) => {
                                    if (p?.date) dayNumByDateKey.set(p.date, idx + 1);
                                });

                                return groupItineraryItemsByDay(selectedItineraryOption).map(([dayKey, items], dayIndex) => {
                                    const dayNumber =
                                        dayKey === 'No date'
                                            ? 1
                                            : (dayNumByDateKey.get(dayKey) ?? dayIndex + 1);

                                    return (
                                        <details
                                            key={`${dayKey}-${dayIndex}`}
                                            className="itinerary-detail-day"
                                            open={dayIndex === 0}
                                        >
                                            <summary>
                                                {dayKey === 'No date'
                                                    ? `Day ${dayNumber} · Unscheduled`
                                                    : `Day ${dayNumber} · ${new Date(`${dayKey}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC' })}`}
                                                <span className="itinerary-detail-day-count">
                                                    {items.length} item{items.length === 1 ? '' : 's'}
                                                </span>
                                            </summary>
                                            <ul>
                                                {items.map((item, idx) => (
                                                    <li key={`${dayKey}-item-${idx}`}>
                                                        <span>{item?.label || 'Untitled step'}</span>
                                                        <strong>{item?.cost != null ? `$${Number(item.cost).toFixed(2)}` : '-'}</strong>
                                                    </li>
                                                ))}
                                            </ul>
                                        </details>
                                    );
                                });
                            })()}
                        </div>

                        <details className="itinerary-comments-detail" open>
                            <summary>
                                Comments
                                {(() => {
                                    const comments = itineraryCommentsFlat(selectedItineraryOption);
                                    const count = comments.length;
                                    return (
                                        <span className="itinerary-detail-day-count">
                                            {count} comment{count === 1 ? '' : 's'}
                                        </span>
                                    );
                                })()}
                            </summary>

                            {(() => {
                                const comments = itineraryCommentsFlat(selectedItineraryOption);
                                const myUid = mongoIdString(dbUser?._id);

                                return (
                                    <div className="itinerary-comments-body">
                                        <div className="itinerary-comments-scroll" role="list">
                                            {comments.length ? (
                                                comments.map((item, idx) => {
                                                    const authorLabel =
                                                        String(item?.userLabel || '').trim() ||
                                                        (item?.userId && item.userId === myUid
                                                            ? (dbUser?.name || dbUser?.email || 'You')
                                                            : item?.userId);

                                                    const when = item?.createdAt
                                                        ? new Date(item.createdAt).toLocaleString('en-US', {
                                                            timeZone: 'UTC',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })
                                                        : '';

                                                    return (
                                                        <div
                                                            key={`${item?.userId || 'unknown'}-${item?.createdAt || idx}`}
                                                            className="itinerary-comment-item itinerary-comment-item--flat"
                                                            role="listitem"
                                                        >
                                                            <div className="itinerary-comment-item-meta">
                                                                <span className="itinerary-comment-item-author">
                                                                    {authorLabel || 'User'}
                                                                </span>
                                                                <span className="itinerary-comment-item-date">{when}</span>
                                                            </div>
                                                            <p className="itinerary-comment-item-text">{item.comment}</p>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="itinerary-comments-empty">No comments yet.</div>
                                            )}
                                        </div>

                                        <div className="itinerary-comment-form">
                                            <label htmlFor="itinerary-comment-text" className="itinerary-comment-label">
                                                Add a comment
                                            </label>
                                            <textarea
                                                id="itinerary-comment-text"
                                                rows={3}
                                                value={itineraryCommentText}
                                                onChange={(e) => setItineraryCommentText(e.target.value)}
                                                placeholder="Write your comment..."
                                                disabled={itineraryCommentSubmitting}
                                            />
                                            <div className="itinerary-comment-actions">
                                                <button
                                                    type="button"
                                                    className="itinerary-comment-submit"
                                                    onClick={handleAddItineraryComment}
                                                    disabled={itineraryCommentSubmitting}
                                                >
                                                    {itineraryCommentSubmitting ? 'Posting...' : 'Post Comment'}
                                                </button>
                                            </div>
                                            {itineraryCommentError && (
                                                <p className="td-invite-error" role="alert" style={{ marginTop: '8px' }}>
                                                    {itineraryCommentError}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </details>

                        <div className="td-modal-actions">
                            <button
                                className="td-modal-btn td-modal-btn--cancel"
                                onClick={() => { setShowItineraryDetailsModal(false); setItineraryCommentText(''); setItineraryCommentError(''); }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteItineraryConfirm && itineraryOptionToDelete && (
                <div className="td-modal-overlay" onClick={() => setShowDeleteItineraryConfirm(false)}>
                    <div className="td-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete Itinerary Option</h3>
                        <p>Delete "{itineraryOptionToDelete.title || 'this option'}"?</p>
                        <div className="td-modal-actions">
                            <button
                                className="td-modal-btn td-modal-btn--cancel"
                                onClick={() => setShowDeleteItineraryConfirm(false)}
                                disabled={isDeletingItineraryOption}
                            >
                                Cancel
                            </button>
                            <button
                                className="td-modal-btn td-modal-btn--danger"
                                onClick={handleDeleteItineraryOption}
                                disabled={isDeletingItineraryOption}
                            >
                                {isDeletingItineraryOption ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Accommodation Details Modal */}
            {showAccModal && selectedAcc && (
                <div className="acc-modal-overlay" onClick={handleCloseAccModal}>
                    <div className="acc-modal-card" onClick={(e) => e.stopPropagation()}>
                        <header className="acc-modal-header">
                            <span className="acc-type-tag">{selectedAcc.type}</span>
                            <h2>{selectedAcc.name}</h2>
                            <button className="acc-modal-close" onClick={handleCloseAccModal}>✕</button>
                        </header>

                        <div className="acc-modal-body">
                            <section className="acc-modal-section">
                                <h4>Booking Information</h4>
                                <div className="acc-modal-grid">
                                    <p><strong>Confirmation #:</strong> {selectedAcc.confirmationNumber}</p>
                                    <p><strong>Status: </strong> 
                                        <span className={`acc-status-pill ${selectedAcc.isPaid ? 'paid' : 'unpaid'}`}>
                                            {selectedAcc.isPaid ? 'Paid' : 'Unpaid'}
                                        </span>
                                    </p>
                                    <p><strong>Total Cost:</strong> {selectedAcc.cost ? `$${selectedAcc.cost.toFixed(2)}` : 'N/A'}</p>
                                </div>
                            </section>

                            <section className="acc-modal-section">
                                <h4>Stay Information</h4>
                                <p><strong>📍 Address:</strong> {selectedAcc.address}</p>
                                <div className="acc-modal-grid">
                                    <p><strong>📅 Check-in:</strong> {new Date(selectedAcc.checkInDate).toLocaleDateString('en-US', { timeZone: 'UTC' })} @ {selectedAcc.checkInTime}</p>
                                    <p><strong>📅 Check-out:</strong> {new Date(selectedAcc.checkOutDate).toLocaleDateString('en-US', { timeZone: 'UTC' })} @ {selectedAcc.checkOutTime}</p>
                                </div>
                            </section>

                            <section className="acc-modal-section">
                                <h4>Contact & Links</h4>
                                <div className="acc-modal-grid">
                                    <p>
                                        <strong>📞 Phone:</strong> {selectedAcc.phoneNumber 
                                            ? <a href={`tel:${selectedAcc.phoneNumber}`}>{selectedAcc.phoneNumber}</a> 
                                            : <span className="acc-modal-empty">N/A</span>}
                                    </p>
                                    <p>
                                        <strong>✉️ Email:</strong> {selectedAcc.email 
                                            ? <a href={`mailto:${selectedAcc.email}`}>{selectedAcc.email}</a> 
                                            : <span className="acc-modal-empty">N/A</span>}
                                    </p>
                                    <p>
                                        <strong>🌐 Website:</strong> {selectedAcc.website 
                                            ? <a href={selectedAcc.website} target="_blank" rel="noreferrer">Visit Site</a> 
                                            : <span className="acc-modal-empty">N/A</span>}
                                    </p>
                                </div>
                            </section>

                            <section className="acc-modal-section">
                                <h4>Notes</h4>
                                <div className="acc-modal-notes">
                                    {selectedAcc.notes || "No additional notes for this stay."}
                                </div>
                            </section>
                        </div>

                        <footer className="acc-modal-footer">
                            <button className="td-btn-secondary" onClick={handleCloseAccModal}>Close</button>
                        </footer>
                    </div>
                </div>
            )}

            {/* Activity Details Modal */}
            {showActivityModal && selectedActivity && (
                <div className="acc-modal-overlay" onClick={handleCloseActivityModal}>
                    <div className="acc-modal-card" onClick={(e) => e.stopPropagation()}>
                        <header className="acc-modal-header">
                            <span className="acc-type-tag">{selectedActivity.activityType}</span>
                            <h2>{selectedActivity.name}</h2>
                            <button className="acc-modal-close" onClick={handleCloseActivityModal}>✕</button>
                        </header>

                        <div className="acc-modal-body">
                            <section className="acc-modal-section">
                                <h4>Activity Information</h4>
                                <div className="acc-modal-grid">
                                    <p><strong>📍 Location:</strong> {selectedActivity.address}</p>
                                    <p><strong>Cost:</strong> {selectedActivity.cost ? `$${selectedActivity.cost.toFixed(2)}` : 'N/A'}</p>
                                </div>
                                <div className="acc-modal-grid">
                                    <p><strong>📅 Date:</strong> {new Date(selectedActivity.activityDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
                                    <p><strong>⏰ Time:</strong> {selectedActivity.startTime.split(':')[0] > 12 ? selectedActivity.startTime.split(':')[0] - 12 + ":" + selectedActivity.startTime.split(':')[1] + " PM" : selectedActivity.startTime + " AM"} 
                                - {selectedActivity.endTime.split(':')[0] > 12 ? selectedActivity.endTime.split(':')[0] - 12 + ":" + selectedActivity.endTime.split(':')[1] + " PM" : selectedActivity.endTime + " AM"}</p>
                                </div>
                            </section>

                            <section className="acc-modal-section">
                                <h4>Contact & Links</h4>
                                <div className="acc-modal-grid">
                                    <p>
                                        <strong>📞 Phone:</strong> {selectedActivity.phoneNumber 
                                            ? <a href={`tel:${selectedActivity.phoneNumber}`}>{selectedActivity.phoneNumber}</a> 
                                            : <span className="acc-modal-empty">N/A</span>}
                                    </p>
                                    <p>
                                        <strong>✉️ Email:</strong> {selectedActivity.email 
                                            ? <a href={`mailto:${selectedActivity.email}`}>{selectedActivity.email}</a> 
                                            : <span className="acc-modal-empty">N/A</span>}
                                    </p>
                                    <p>
                                        <strong>🌐 Website:</strong> {selectedActivity.website 
                                            ? <a href={selectedActivity.website} target="_blank" rel="noreferrer">Visit Site</a> 
                                            : <span className="acc-modal-empty">N/A</span>}
                                    </p>
                                </div>
                            </section>

                            <section className="acc-modal-section">
                                <h4>Attending</h4>
                                <div className="acc-modal-notes">
                                    {selectedActivity.attending.length > 0 ? selectedActivity.attending.map(person => person.name).join(', ') : "No attendees for this activity."}
                                </div>
                            </section>

                            <section className="acc-modal-section">
                                <h4>Notes</h4>
                                <div className="acc-modal-notes">
                                    {selectedActivity.notes || "No additional notes for this activity."}
                                </div>
                            </section>
                        </div>

                        <footer className="acc-modal-footer">
                            <button className="td-btn-secondary" onClick={handleCloseActivityModal}>Close</button>
                        </footer>
                    </div>
                </div>
            )}

            {/* ── Delete Accommodation Confirm ── */}
            {showAccConfirm && (
                <div className="td-modal-overlay" onClick={() => setShowAccConfirm(false)}>
                    <div className="td-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Confirm Delete</h3>
                        <p>Delete stay at "<strong>{accToDelete?.name}</strong>"?</p>
                        <div className="td-modal-actions">
                            <button
                                className="td-modal-btn td-modal-btn--danger"
                                onClick={async () => {
                                    try {
                                        await deleteAccommodation(id, accToDelete._id, mongoIdString(dbUser._id));
                                        setAccommodations(prev => prev.filter(a => a._id !== accToDelete._id));
                                        const updatedTrip = await getTripById(id, dbUser._id);
                                        setTrip(updatedTrip);
                                        setShowAccConfirm(false);
                                        setAccToDelete(null);
                                    } catch (err) {
                                        console.error("Failed to delete accommodation:", err);
                                        alert("Could not delete accommodation. Please try again.");
                                    }
                                }}
                            >
                                Confirm
                            </button>
                            <button 
                                className="td-modal-btn td-modal-btn--cancel" 
                                onClick={() => setShowAccConfirm(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Activites Confirm ── */}
            {showActivityConfirm && (
                <div className="td-modal-overlay" onClick={() => setShowActivityConfirm(false)}>
                    <div className="td-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Confirm Delete</h3>
                        <p>Delete Activity: "<strong>{activityToDelete?.name}</strong>"?</p>
                        <div className="td-modal-actions">
                            <button
                                className="td-modal-btn td-modal-btn--danger"
                                onClick={async () => {
                                    try {
                                        await deleteActivity(id, activityToDelete._id, mongoIdString(dbUser._id));
                                        setActivities(prev => prev.filter(a => a._id !== activityToDelete._id));
                                        const updatedTrip = await getTripById(id, dbUser._id);
                                        setTrip(updatedTrip);
                                        setShowActivityConfirm(false);
                                        setActivityToDelete(null);
                                    } catch (err) {
                                        console.error("Failed to delete activity:", err);
                                        alert("Could not delete activity. Please try again.");
                                    }
                                }}
                            >
                                Confirm
                            </button>
                            <button 
                                className="td-modal-btn td-modal-btn--cancel" 
                                onClick={() => setShowActivityConfirm(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Hidden PDF Render (DO NOT REMOVE) ── */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
    
                {/* Timeline PDF */}
                <div ref={timelineRef} className="td-pdf-section" style={{ paddingBottom: '80px' }}>
                <div className="td-pdf-header">
                        <h1>{trip.name}</h1>
                        {trip.description && <p>{trip.description}</p>}
                        <p>
                            {new Date(trip.startDate).toLocaleDateString()} –{' '}
                            {new Date(trip.endDate).toLocaleDateString()}
                        </p>
                        <p>Budget: ${trip.budget?.toFixed(2) || 'N/A'}</p>
                    </div>

                    {/* reuse your timeline UI */}
                    {renderTimelineMult()}
                </div>

                {/* Packing List PDF */}
                <div ref={packingRef} className="td-pdf-section" style={{ paddingBottom: '80px' }}>
                <div className="td-pdf-header">
                        <h1>Packing List</h1>
                    </div>

                    <ul className="td-pdf-packing-list">
                        {packingItems.map(item => (
                            <li key={item.id}>
                                <input type="checkbox" checked={item.checked} readOnly />
                                {item.text}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
