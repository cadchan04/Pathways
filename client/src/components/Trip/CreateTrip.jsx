import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip } from '../../services/tripServices';
import { useUser } from '../../../context/useUser';
import { getTodayDateString, isDateBeforeToday } from '../Route/routeUtils';

import './CreateTrip.css';

export default function CreateTrip() {
    const navigate = useNavigate();
    const { dbUser } = useUser();
    const today = getTodayDateString();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: ''
    });

    const [errors, setErrors] = useState({});

    const validateDates = () => {
        const newErrors = {};

        if (formData.startDate && isDateBeforeToday(formData.startDate, today)) {
            newErrors.startDate = 'Start date cannot be in the past.';
        }

        if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
            newErrors.endDate = 'End date cannot be before start date.';
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

        // make sure userId exists
        if (!dbUser?._id) {
            console.error("No userId found. Please wait for sync or log in again.");
            return;
        }

        const newTrip = {
            ...formData,
            owner: dbUser._id,
            collaboratorIds: [],
            routes: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            const savedTrip = await createTrip(newTrip);
            
            if (savedTrip) {
                console.log("Trip saved to MongoDB vai service");
                navigate(`/view-trip-details/${savedTrip._id}`); 
            }

        } catch (err) {
            console.error("Error creating trip:", err);
        }
    }

    return (
        <div className="create-trip-container">
            <h2>Plan a New Journey</h2>
            <form onSubmit={handleSubmit} className="create-trip-form">
                <input
                    type="text"
                    placeholder="Trip Name" required
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
                <input
                    type="text"
                    placeholder="Trip Description" required
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
                <input 
                    type="date"
                    min={today}
                    onChange={(e) => {
                        setFormData({...formData, startDate: e.target.value});
                        setErrors({...errors, startDate: ''});
                    }} 
                />
                {errors.startDate && <p className="error-message">{errors.startDate}</p>}
                <input 
                    type="date"
                    min={formData.startDate || today}
                    onChange={(e) => {
                        setFormData({...formData, endDate: e.target.value});
                        setErrors({...errors, endDate: ''});
                    }} 
                />
                {errors.endDate && <p className="error-message">{errors.endDate}</p>}
                <div className="budget-input-wrapper">
                    
                    <span className="budget-symbol">$</span>
                    <input
                        type="number"
                        min="0"
                        step="10"
                        placeholder="Budget (optional)"
                        onChange={(e) => {
                            let value = e.target.value;
                            if (value && value.includes('.')) {
                                const [integer, decimal] = value.split('.');
                                if (decimal.length > 2) {
                                    value = `${integer}.${decimal.slice(0, 2)}`;
                                    e.target.value = value;
                                }
                            }
                            setFormData({...formData, budget: value});
                        }}
                    />
                </div>
                <button type="submit">Create</button>
                <button type="button" onClick={() => navigate('/my-trips')}>Cancel</button>
            </form> 
        </div>
    )
}