import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createAccommodation } from '../../services/accommodationServices';
import { useUser } from '../../../context/useUser';
import { getTodayDateString, isDateBeforeToday } from '../Route/routeUtils';

import './CreateAccommodation.css';

export default function CreateAccommodation() {
    const navigate = useNavigate();
    const { tripId } = useParams();
    const { dbUser } = useUser();
    const today = getTodayDateString();
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        type: 'Hotel',
        address: '',
        phoneNumber: '',
        email: '',
        website: '',
        checkInDate: '',
        checkInTime: '15:00',
        checkOutDate: '',
        checkOutTime: '10:00',
        confirmationNumber: '',
        cost: '',
        isPaid: false,
        notes: ''
    });

    const validateDates = () => {
        const newErrors = {};

        if (formData.checkInDate && isDateBeforeToday(formData.checkInDate, today)) {
            newErrors.checkInDate = 'Check-in date cannot be in the past.';
        }

        if (formData.checkInDate && formData.checkOutDate && formData.checkOutDate < formData.checkInDate) {
            newErrors.checkOutDate = 'Check-out date cannot be before check-in date.';
        }

        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const dateErrors = validateDates();
        if (Object.keys(dateErrors).length > 0) {
            setErrors(dateErrors);
            return;
        }

        if (!dbUser?._id) {
            console.error("No userId found. Please wait for sync or log in again.");
            return;
        }

        const newAccommodation = {
            ...formData,
            tripId: tripId,
            owner: dbUser._id,
            cost: formData.cost === '' ? null : Number(formData.cost),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            const savedAccommodation = await createAccommodation(tripId, newAccommodation);
            
            if (savedAccommodation) {
                console.log("Accommodation saved to MongoDB via service");
                navigate(`/view-trip-details/${tripId}`);
            }

        } catch (err) {
            console.error("Error creating accommodation:", err);
            setErrors({ submit: err.response?.data?.error || "Failed to create accommodation." });
        } finally {
            setIsSubmitting(false);
        }
    }

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

    return (
        <div className="create-accommodation-container">
            <h2>Add Accommodation</h2>
            <form onSubmit={handleSubmit} className="create-trip-form">
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
                        {isSubmitting ? 'Creating...' : 'Create'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                        Cancel
                    </button>
                </div>
            </form> 
        </div>
    );
}