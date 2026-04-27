import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import './ActivitiesTab.css';

export default function ActivitiesTab({
    // tripId,
    activities = [],
    isOwner,
    tripDates = { start: null, end: null },
    onOpenModal,
    onDelete
}) {
    const navigate = useNavigate();
    const [activeMenuId, setActiveMenuId] = useState(null);
    const deletingId = useState(null);

    // sort activities by date
    const sortedActivities = useMemo(() => {
        return [...activities].sort((a, b) => {
            const dateA = new Date(a.activityDate?.$date || a.activityDate);
            const dateB = new Date(b.activityDate?.$date || b.activityDate);
            
            if (dateA == dateB) {
                // If same date, sort by start time
                const startA = a.startTime || '00:00';
                const startB = b.startTime || '00:00';
                return startA.localeCompare(startB);
            }

            return dateA - dateB;
        });
    }, [activities]);

    // --- outside click handler for dropdowns ---
    useEffect(() => {
        const closeMenu = () => setActiveMenuId(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    // --- helpers ---
    const isOutOfRange = (activityDate) => {
        if (!tripDates?.start || !tripDates?.end) return false;

        const formatDate = (d) => {
            if (!d) return null;
            const date = new Date(d?.$date || d);
            return date.toISOString().split('T')[0];
        };

        const activityDateStr = formatDate(activityDate);
        const tripStartStr = formatDate(tripDates.start);
        const tripEndStr = formatDate(tripDates.end);

        // DEBUGGING
        // console.log(`Comparing ==> Acc Checkin: ${checkInStr} vs Trip Start: ${tripStartStr} | Acc Checkout: ${checkOutStr} vs Trip End: ${tripEndStr}`);

        if (!activityDateStr || !tripStartStr || !tripEndStr) return false;

        const startsTooEarly = activityDateStr < tripStartStr;
        const endsTooLate = activityDateStr > tripEndStr;

        return startsTooEarly || endsTooLate;
    };

    const handleDelete = async (acc) => {
        onDelete(acc);
    };

    const toggleMenu = (e, id) => {
        e.stopPropagation(); 
        setActiveMenuId(activeMenuId === id ? null : id);
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

    return (
        <div className="activities-tab">
            <div className="td-content-header">
                <h2>Activities</h2>
            </div>

            <div className="activities-list">
                {sortedActivities.length === 0 ? (
                    <div className="td-empty-state">
                        <span className="td-empty-icon">⌂</span>
                        <p>No activities added yet.</p>
                    </div>
                ) : (
                    sortedActivities.map((activity) => {
                        const warning = isOutOfRange(activity.activityDate);
                        const startTime = activity.startTime.split(':')[0] > 12 ? activity.startTime.split(':')[0] - 12 + ":" + activity.startTime.split(':')[1] + " PM" : activity.startTime + " AM";
                        const endTime = activity.endTime.split(':')[0] > 12 ? activity.endTime.split(':')[0] - 12 + ":" + activity.endTime.split(':')[1] + " PM" : activity.endTime + " AM";
                        const durationHrs = Number(endTime.split(':')[0]) - Number(startTime.split(':')[0]);
                        const durationMins = Number(activity.endTime.split(':')[1]) - Number(activity.startTime.split(':')[1]);
                        const duration = durationHrs + (durationMins > 0 ? 0.5 : 0);
                        
                        return (
                            <div key={activity._id} className={`activity-card ${warning ? 'activity-card--warning' : ''}`}>

                                {/* Name, Type, Address  */}
                                <div className="activity-col activity-col-main">
                                    <span className="activity-type-tag">{activity.activityType}</span>
                                    <div className="activity-header-row">
                                        <h3>{warning && "⚠️ "}{activity.name}</h3>
                                    </div>
                                    <p className="activity-address">📍 {activity.address}</p>
                                    {activity.notes && <p className="activity-notes-preview">"{activity.notes}"</p>}
                                </div>

                                {/* Dates and Times */}
                                <div className="activity-col activity-col-dates">
                                    <div className="activity-date-block">
                                        <span className="activity-label">Start</span>
                                        <strong>{startTime}</strong>
                                    </div>
                                    <div className="activity-date-divider">
                                        <div className="activity-line"></div>
                                        <span className="activity-nights">
                                            {durationHrs} {durationHrs === 1 ? 'hr' : 'hrs'}{" "}{durationMins}{'m'}
                                        </span>
                                    </div>
                                    <div className="activity-date-block">
                                        <span className="activity-label">End</span>
                                        <strong>{endTime} </strong>
                                    </div>
                                </div>

                                {/* Logistics and Cost */}
                                <div className="activity-col activity-col-meta">
                                    <div className="activity-meta-item">
                                        <span className="activity-label">Date</span>
                                        <strong>{formatDate(activity.activityDate) || 'N/A'}</strong>
                                    </div>
                                    <div className="activity-meta-item">
                                        <span className="activity-label">Total Cost</span>
                                        <strong>{activity.cost ? `$${activity.cost.toFixed(2)}` : 'N/A'}</strong>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="activity-col activity-col-actions">
                                    <div className="activity-menu-container">
                                        <button 
                                            className="activity-menu-trigger" 
                                            onClick={(e) => toggleMenu(e, activity._id)}
                                        >
                                            ⋮
                                        </button>

                                        {activeMenuId === activity._id && (
                                            <div className="activity-dropdown">
                                                <button onClick={() => onOpenModal(activity)}>View Details</button>
                                                
                                                {isOwner && (
                                                    <>
                                                        <button onClick={() => navigate(`/edit-activity/${activity._id}`)}>
                                                            Edit
                                                        </button>
                                                        <button 
                                                            className="delete-option" 
                                                            onClick={() => handleDelete(activity)}
                                                            disabled={deletingId === activity._id}
                                                        >
                                                            {deletingId === activity._id ? 'Deleting...' : 'Delete'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    )
}