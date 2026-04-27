import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import './AccommodationsTab.css';

export default function AccommodationsTab({
    // tripId,
    accommodations = [],
    isOwner,
    tripDates = { start: null, end: null },
    onOpenModal,
    onDelete
}) {
    const navigate = useNavigate();
    const [activeMenuId, setActiveMenuId] = useState(null);
    const deletingId = useState(null);

    // sort accommodations by check-in date
    const sortedAccommodations = useMemo(() => {
        return [...accommodations].sort((a, b) => {
            const dateA = new Date(a.checkInDate?.$date || a.checkInDate);
            const dateB = new Date(b.checkInDate?.$date || b.checkInDate);
            return dateA - dateB;
        });
    }, [accommodations]);

    // --- outside click handler for dropdowns ---
    useEffect(() => {
        const closeMenu = () => setActiveMenuId(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    // --- helpers ---
    const isOutOfRange = (checkIn, checkOut) => {
        if (!tripDates?.start || !tripDates?.end) return false;

        const formatDate = (d) => {
            if (!d) return null;
            const date = new Date(d?.$date || d);
            return date.toISOString().split('T')[0];
        };

        const checkInStr = formatDate(checkIn);
        const checkOutStr = formatDate(checkOut);
        const tripStartStr = formatDate(tripDates.start);
        const tripEndStr = formatDate(tripDates.end);

        // DEBUGGING
        // console.log(`Comparing ==> Acc Checkin: ${checkInStr} vs Trip Start: ${tripStartStr} | Acc Checkout: ${checkOutStr} vs Trip End: ${tripEndStr}`);

        if (!checkInStr || !tripStartStr || !tripEndStr) return false;

        const startsTooEarly = checkInStr < tripStartStr;
        const endsTooLate = checkOutStr > tripEndStr;

        return startsTooEarly || endsTooLate;
    };

    const handleDelete = async (acc) => {
        onDelete(acc);
    };

    const toggleMenu = (e, id) => {
        e.stopPropagation(); 
        setActiveMenuId(activeMenuId === id ? null : id);
    };

    return (
        <div className="accommodations-tab">
            <div className="td-content-header">
                <h2>Accommodations</h2>
            </div>

            <div className="accommodations-list">
                {sortedAccommodations.length === 0 ? (
                    <div className="td-empty-state">
                        <span className="td-empty-icon">⌂</span>
                        <p>No accommodations added yet.</p>
                    </div>
                ) : (
                    sortedAccommodations.map((acc) => {
                        const warning = isOutOfRange(acc.checkInDate, acc.checkOutDate);
                        const nights = Math.ceil((new Date(acc.checkOutDate) - new Date(acc.checkInDate)) / (1000 * 60 * 60 * 24));
                        
                        return (
                            <div key={acc._id} className={`acc-card ${warning ? 'acc-card--warning' : ''}`}>

                                {/* Name, Type, Address  */}
                                <div className="acc-col acc-col-main">
                                    <span className="acc-type-tag">{acc.type}</span>
                                    <div className="acc-header-row">
                                        <h3>{warning && "⚠️ "}{acc.name}</h3>
                                    </div>
                                    <p className="acc-address">📍 {acc.address}</p>
                                    {acc.notes && <p className="acc-notes-preview">"{acc.notes}"</p>}
                                </div>

                                {/* Dates and Times */}
                                <div className="acc-col acc-col-dates">
                                    <div className="acc-date-block">
                                        <span className="acc-label">Check In</span>
                                        <strong>{new Date(acc.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</strong>
                                        <span className="acc-subtext">{acc.checkInTime}</span>
                                    </div>
                                    <div className="acc-date-divider">
                                        <div className="acc-line"></div>
                                        <span className="acc-nights">
                                            {nights} {nights === 1 ? 'night' : 'nights'}
                                        </span>
                                    </div>
                                    <div className="acc-date-block">
                                        <span className="acc-label">Check Out</span>
                                        <strong>{new Date(acc.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</strong>
                                        <span className="acc-subtext">{acc.checkOutTime}</span>
                                    </div>
                                </div>

                                {/* Logistics and Cost */}
                                <div className="acc-col acc-col-meta">
                                    <div className="acc-meta-item">
                                        <span className="acc-label">Confirmation # </span>
                                        <strong>{acc.confirmationNumber}</strong>
                                    </div>
                                    <div className="acc-meta-item">
                                        <span className="acc-label">Total Cost</span>
                                        <strong>{acc.cost ? `$${acc.cost.toFixed(2)}` : 'N/A'}</strong>
                                    </div>
                                    <span className={`acc-status-pill ${acc.isPaid ? 'paid' : 'unpaid'}`}>
                                        {acc.isPaid ? '✓ Paid' : '⌛ Unpaid'}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="acc-col acc-col-actions">
                                    <div className="acc-menu-container">
                                        <button 
                                            className="acc-menu-trigger" 
                                            onClick={(e) => toggleMenu(e, acc._id)}
                                        >
                                            ⋮
                                        </button>

                                        {activeMenuId === acc._id && (
                                            <div className="acc-dropdown">
                                                <button onClick={() => onOpenModal(acc)}>View Details</button>
                                                
                                                {isOwner && (
                                                    <>
                                                        <button onClick={() => navigate(`/edit-accommodation/${acc._id}`)}>
                                                            Edit
                                                        </button>
                                                        <button 
                                                            className="delete-option" 
                                                            onClick={() => handleDelete(acc)}
                                                            disabled={deletingId === acc._id}
                                                        >
                                                            {deletingId === acc._id ? 'Deleting...' : 'Delete'}
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