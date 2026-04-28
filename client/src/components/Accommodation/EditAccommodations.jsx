import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAccommodationById, updateAccommodation } from '../../services/accommodationServices';
import { useUser } from '../../../context/useUser';

import './EditAccommodations.css';

export default function EditAccommodations() {
    const navigate = useNavigate();
    const { tripId, accId } = useParams();
    const { dbUser } = useUser();
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState(null);

    useEffect(() => {
        console.log("EditAccommodations mounted with tripId:", tripId, "and accId:", accId);
        const fetchAccommodation = async () => {
            try {
                const acc = await getAccommodationById(tripId, accId, dbUser._id);
                console.log("Fetched accommodation for editing:", acc);
                setFormData({
                    ...acc,
                    checkInDate: acc.checkInDate ? new Date(acc.checkInDate).toISOString().split('T')[0] : '',
                    checkOutDate: acc.checkOutDate ? new Date(acc.checkOutDate).toISOString().split('T')[0] : '',
                });
            } catch (err) {
                console.error("Error fetching accommodation:", err);
            }
        };

        if (tripId && accId) {
            fetchAccommodation();
        }
    }, [tripId, accId, dbUser]);

    const validateDates = () => {
        const newErrors = {};

        if (formData.checkInDate && formData.checkOutDate && formData.checkOutDate < formData.checkInDate) {
            newErrors.checkOutDate = 'Check-out date cannot be before check-in date.';
        }

        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("Submitting accommodation with form data:", formData);

        const dateErrors = validateDates();
        if (Object.keys(dateErrors).length > 0) {
            setErrors(dateErrors);
            return;
        }

        if (!dbUser?._id) {
            console.error("No userId found. Please wait for sync or log in again.");
            return;
        }

        const updatedAccommodation = {
            ...formData,
            tripId: tripId,
            owner: dbUser._id,
            cost: formData.cost === '' ? null : Number(formData.cost),
            createdAt: formData.createdAt,
            updatedAt: new Date().toISOString()
        };

        try {
            const savedAccommodation = await updateAccommodation(tripId, accId, updatedAccommodation, dbUser._id);
            
            if (savedAccommodation) {
                console.log("Accommodation saved to MongoDB via service");
                navigate(`/view-trip-details/${tripId}`, { state: { activeTab: 'accommodations' } });
            }

        } catch (err) {
            console.error("Error updating accommodation:", err);
            setErrors({ submit: err.response?.data?.error || "Failed to update accommodation." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'cost') {
            const regex = /^\d*(\.\d{0,2})?$/;

            if (!regex.test(value)) {
                return;
            }
        }
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    if (!formData) {
        return <div className="edit-accommodations-container"><p>Loading accommodation details...</p></div>;
    }

    return (
        <div className="edit-accommodation-container">
            <h1>Edit Accommodation</h1>
            <form onSubmit={handleSubmit} className="edit-accommodation-form">
                {/* --- Basic Information --- */}
                <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                        <label>Accommodation Name *</label>
                        <input
                            type="text" name="name" value={formData.name}
                            placeholder="e.g. Grand Hyatt" required onChange={handleChange}
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Type *</label>
                        <select name="type" value={formData.type} onChange={handleChange}>
                            <option value="Hotel">Hotel</option>
                            <option value="Airbnb">Airbnb</option>
                            <option value="Hostel">Hostel</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>Address *</label>
                    <input
                        type="text"
                        name="address"
                        value={formData.address}
                        required
                        onChange={handleChange}
                    />
                </div>

                {/* --- Contact Info Section --- */}
                <div className="form-row">
                    <div className="form-group">
                        <label>Phone Number</label>
                        <input
                            type="tel" name="phoneNumber" value={formData.phoneNumber}
                            placeholder="(555) 000-0000" onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email" name="email" value={formData.email}
                            placeholder="frontdesk@hotel.com" onChange={handleChange}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Website</label>
                    <input
                        type="url" name="website" value={formData.website}
                        placeholder="https://www.hotel.com" onChange={handleChange}
                    />
                </div>

                {/* --- Dates and Confirmation --- */}
                <div className="form-row">
                    <div className="form-group">
                        <label>Check-in Date *</label>
                        <input 
                            type="date"
                            name="checkInDate"
                            value={formData.checkInDate}
                            required
                            onChange={handleChange} 
                        />
                        {errors.checkInDate && <p className="error-text">{errors.checkInDate}</p>}
                    </div>
                    <div className="form-group">
                        <label>Check-in Time</label>
                        <input
                            type="time"
                            name="checkInTime"
                            value={formData.checkInTime}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {errors.checkInDate && <p className="error-message">{errors.checkInDate}</p>}

                <div className="form-row">
                    <div className="form-group">
                        <label>Check-out Date *</label>
                        <input 
                            type="date"
                            name="checkOutDate"
                            value={formData.checkOutDate}
                            required
                            min={formData.checkInDate}
                            onChange={handleChange} 
                        />
                        {errors.checkOutDate && <p className="error-text">{errors.checkOutDate}</p>}
                    </div>
                    <div className="form-group">
                        <label>Check-out Time</label>
                        <input
                            type="time"
                            name="checkOutTime"
                            value={formData.checkOutTime}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {errors.checkOutDate && <p className="error-message">{errors.checkOutDate}</p>}

                {/* --- Logistics --- */}
                <div className="form-group">
                    <label>Confirmation Number *</label>
                    <input
                        type="text"
                        name="confirmationNumber"
                        value={formData.confirmationNumber}
                        required
                        onChange={handleChange}
                    />
                </div>

                <div className="form-row-">
                    <div className="form-group">
                        <label>Cost</label>
                        <div className="budget-input-wrapper">
                            <span className="budget-symbol">$</span>
                            <input
                                type="number"
                                name="cost"
                                min="0"
                                step="001"
                                value={formData.cost}
                                placeholder="0.00"
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                    <div className="checkbox-group-wrapper">
                        <label className="checkbox-container">
                            <span>Already Paid?</span>
                            <input
                                type="checkbox"
                                name="isPaid"
                                checked={formData.isPaid}
                                onChange={handleChange}
                            />
                        </label>
                    </div>
                </div>

                <div className="form-group">
                    <label>Notes</label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        placeholder="Room details, key codes, etc."
                        onChange={handleChange}
                    />
                </div>

                {errors.submit && <p className="error-message">{errors.submit}</p>}

                <div className="form-actions">
                    <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Updating...' : 'Save Changes'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate(`/view-trip-details/${tripId}`, { state: { activeTab: 'accommodations' } })}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}