import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTripById, updateTrip, deleteTrip } from '../../services/tripServices';

import './EditTrip.css';

export default function EditTrip() {
    const { id } = useParams();
    const navigate = useNavigate();
    
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

    // delete popup state
    const [showConfirm, setShowConfirm] = useState(false);

    // fetch existing trip data
    useEffect(() => {
        const fetchTrip = async () => {
            try {
                const data = await getTripById(id);

                // format dates
                setFormData({
                    name: data.name || '',
                    description: data.description || '',
                    startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
                    endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '',
                    budget: data.budget || 0,
                    totalCost: data.totalCost || 0
                });
            } catch (error) {
                console.error("Error fetching trip for editing:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchTrip();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateTrip(id, formData);

            navigate(`/view-trip-details/${id}`);
        } catch (err) {
            console.error("Error in submitting and fetching trip for editing:", err);
            setError("Failed to load trip details. Please try again.");
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

    // Delete Trip logic for a single trip view
    const handleDeleteTrip = async () => {
        try {
            await deleteTrip(id);
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
                            type="date" name="startDate" 
                            value={formData.startDate} onChange={handleChange} 
                        />
                    </div>
                    <div className="form-group">
                        <label>End Date</label>
                        <input 
                            type="date" name="endDate" 
                            value={formData.endDate} onChange={handleChange} 
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Budget ($)</label>
                    <input 
                        type="number" name="budget" 
                        value={formData.budget} onChange={handleChange} 
                    />
                </div>

                <div className="form-actions">
                    <button type="submit" className="save-button">Save Changes</button>

                    <button
                        type="button"
                        className="delete-button"
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
        </div>
    )
};