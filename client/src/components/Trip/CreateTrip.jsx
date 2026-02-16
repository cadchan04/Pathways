import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './CreateTrip.css';

export default function CreateTrip() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newTrip = {
            ...formData,
            owner: "mock_user_123", // replace this later with actual auth user ID
            collaboratorIds: [],
            routes: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            const response = await fetch('/api/trips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTrip)
            });

            if (response.ok) {
                console.log("Trip saved to MongoDB!")
                navigate('/my-trips');
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
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
                />
                <input 
                    type="date"
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                />
                <button type="submit">Create</button>
                <button type="button" onClick={() => navigate('/my-trips')}>Cancel</button>
            </form> 
        </div>
    )
}