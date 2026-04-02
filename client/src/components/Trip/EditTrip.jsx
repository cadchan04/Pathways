import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTripById, updateTrip, deleteTripById, duplicateTrip } from '../../services/tripServices';
import { useUser } from '../../../context/useUser';

import './EditTrip.css';

function mongoIdString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.$oid) return value.$oid;
    return String(value);
}

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

export default function EditTrip() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { dbUser } = useUser();
    
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        budget: 0,
        totalCost: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Date Warning
    const [originalRoutes, setOriginalRoutes] = useState([]);
    const [showDateWarning, setShowDateWarning] = useState(false);

    // Delete popup state
    const [showConfirm, setShowConfirm] = useState(false);

    // Duplicate trip state
    const [duplicating, setDuplicating] = useState(false);
    const [duplicateError, setDuplicateError] = useState(null);

    // fetch existing trip data
    useEffect(() => {
        const fetchTrip = async () => {
            if (!dbUser?._id) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const data = await getTripById(id, dbUser._id);

                if (mongoIdString(data.owner) !== mongoIdString(dbUser._id)) {
                    navigate(`/view-trip-details/${id}`, { replace: true });
                    return;
                }

                // format dates
                setFormData({
                    name: data.name || '',
                    description: data.description || '',
                    startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
                    endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '',
                    budget: data.budget || 0,
                    totalCost: data.totalCost || 0
                });
                setOriginalRoutes(data.routes || []);
            } catch (error) {
                console.error("Error fetching trip for editing:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchTrip();
    }, [id, dbUser?._id, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const executeSubmit = async () => {
        try {
            await updateTrip(id, formData, dbUser._id);
            navigate(`/view-trip-details/${id}`);
        } catch (err) {
            console.error("Error updating trip:", err);
            setError("Failed to update trip. Please try again.");
        } finally {
            setShowDateWarning(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const start = formData.startDate; 
        const end = formData.endDate;

        // basic date validation
        if (start && end && end < start) {
            setError("End date cannot be earlier than the start date.");
            return;
        }

        // check if any existing routes fall outside this new range
        const hasOrphanedRoutes = originalRoutes.some(route => {
            const routeDateStr = toYYYYMMDD(route.departAt);
            if (start && routeDateStr < start) return true;
            if (end && routeDateStr > end) return true;
            return false;
        });

        if (hasOrphanedRoutes) {
            setShowDateWarning(true);
        } else {
            executeSubmit();
        }
    };

    const handleDuplicateTrip = async () => {
        if (!dbUser?._id) return;
        setDuplicateError(null);
        setDuplicating(true);
        try {
            await duplicateTrip(id, dbUser._id);
            navigate('/my-trips');
        } catch (err) {
            setDuplicateError("We couldn't duplicate this trip. Please try again.");
            setDuplicating(false);
            console.log("Error duplicating trip:", err);
        }
    };

    if (error && typeof error === 'string') {
        return (
            <div className="edit-trip-container">
                <p className="error-message">{error}</p>
            </div>
        );
    }
    if (loading) {
        return (
            <div className="edit-trip-container">
                <p>Loading...</p>
            </div>
        );
    }

    if (!dbUser?._id) {
        return (
            <div className="edit-trip-container">
                <p>Sign in to edit this trip.</p>
            </div>
        );
    }

    // Delete Trip logic for a single trip view
    const handleDeleteTrip = async () => {
        try {
            await deleteTripById(id, dbUser._id);
            navigate('/my-trips');
        } catch (err) {
            console.error("Error deleting trip: ", err);
            setError("Could not delete trip. Please try again.");
            setShowConfirm(false);
        }
    }

    return (
        <div className="edit-trip-container">
            <button className="back-cancel-button" onClick={() => navigate(-1)}>← Cancel</button>
            <div className="edit-header">
                {duplicateError && <p className="duplicate-error">{duplicateError}</p>}
                <h1>Edit Trip Details</h1>
            </div>

            {error && <div className="error-message" style={{color: 'red', marginBottom: '15px'}}>
                {error}
            </div>}

            <form onSubmit={handleSubmit} className="edit-trip-form">
                <div className="form-group">
                    <label>Trip Name</label>
                    <input 
                        type="text" name="name" 
                        value={formData.name} onChange={handleChange} required 
                    />
                </div>

                <div className="form-group">
                    <label>Description</label>
                    <textarea 
                        name="description" 
                        value={formData.description} onChange={handleChange} 
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Start Date</label>
                        <input 
                            type="date"
                            name="startDate" 
                            value={formData.startDate}
                            onChange={handleChange} 
                        />
                    </div>
                    <div className="form-group">
                        <label>End Date</label>
                        <input 
                            type="date"
                            name="endDate" 
                            value={formData.endDate}
                            min={formData.startDate}
                            onChange={handleChange} 
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Budget ($)</label>
                    <input 
                        type="number"
                        name="budget" 
                        value={formData.budget}
                        min={0}
                        onChange={handleChange} 
                    />
                </div>

                <div className="form-actions">
                    <button type="submit" className="save-button">Save Changes</button>

                    <button
                        type="button"
                        className="duplicate-trip-button"
                        onClick={handleDuplicateTrip}
                        disabled={duplicating}
                    >
                        {duplicating ? 'Duplicating…' : 'Duplicate Trip'}
                    </button>

                    <button
                        type="button"
                        className="delete-trip-button"
                        onClick={() => setShowConfirm(true)}
                        >
                        Delete Trip
                    </button>
                </div>
            </form>

            {/* Delete Trip Confirmation Popup */}
            {showConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Confirm Delete</h3>
                        <p>Are you sure you want to delete <strong>{formData.name}</strong>? This action cannot be undone.</p>

                        <div className="modal-buttons">
                            <button className="confirm-button" onClick={handleDeleteTrip}>
                                Confirm
                            </button>

                            <button className="cancel-button" onClick={() => setShowConfirm(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Date Warning Popup */}
            {showDateWarning && (
            <div className="modal-overlay">
                <div className="modal-content warning-border">
                    <h3>⚠️ Warning</h3>
                    <p>
                        <strong>One or more routes</strong> in this trip fall outside your new date range. 
                        Do you want to accept these changes anyway?
                    </p>
                    <div className="modal-buttons">
                        <button className="confirm-button" onClick={executeSubmit}>
                            Accept
                        </button>
                        <button className="cancel-button" onClick={() => setShowDateWarning(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

        </div>
    )
};