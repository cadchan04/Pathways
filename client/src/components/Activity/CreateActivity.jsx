import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { useNavigate, useParams } from 'react-router-dom';
import { createActivity } from '../../services/activityServices';
import { useUser } from '../../../context/useUser';
import { getTodayDateString } from '../Route/routeUtils';
import { getTripById } from '../../services/tripServices';
import { getUserById } from '../../services/userServices';

import './CreateActivity.css';

export default function CreateActivity() {
    const navigate = useNavigate();
    const { tripId } = useParams();
    const { dbUser } = useUser();
    const [collaboratorOptions, setCollaboratorOptions] = useState([]);
    const today = getTodayDateString();
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        activityType: 'Sightseeing',
        address: '',
        phoneNumber: '',
        email: '',
        website: '',
        activityDate: '',
        startTime: '12:00',
        endTime: '13:00',
        cost: '',
        attending: [],
        notes: ''
    });

    // Get trip details to find collaborators for people attending this activity
    useEffect(() => {
        const fetchTrip = async () => {
            try {
                const tripData = await getTripById(tripId, dbUser._id);

                const potentialAttendees = tripData.collaborators.map(collab => collab.userId);
                if (!potentialAttendees.includes(tripData.owner)) {
                    potentialAttendees.push(tripData.owner);
                }

                const collaboratorDetails = await Promise.all(potentialAttendees.map(userId => getUserById(userId)));

                // Set collaborator options for the select dropdown
                setCollaboratorOptions(collaboratorDetails.map(collab => ({
                    value: collab._id,
                    label: collab.name || collab.email
                })));

            } catch (err) {
                console.error("Failed to fetch trip data:", err);
            }
        };

        if (dbUser?._id) {
            fetchTrip();
        }
    }, [tripId, dbUser]);

    const validateDates = () => {
        const newErrors = {};

        if (formData.activityDate && formData.endTime && formData.endTime < formData.startTime) {
            newErrors.endTime = 'End time cannot be before start time.';
        }

        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("Submitting activity with form data:", formData);

        const dateErrors = validateDates();
        if (Object.keys(dateErrors).length > 0) {
            setErrors(dateErrors);
            return;
        }

        if (!dbUser?._id) {
            console.error("No userId found. Please wait for sync or log in again.");
            return;
        }

        const newActivity = {
            ...formData,
            tripId: tripId,
            owner: dbUser._id,
            cost: formData.cost === '' ? null : Number(formData.cost),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        console.log("Constructed new activity object:", newActivity);

        try {
            const savedActivity = await createActivity(tripId, newActivity, dbUser._id);
            
            if (savedActivity) {
                console.log("Activity saved to MongoDB via service");
                navigate(`/view-trip-details/${tripId}`, { state: { activeTab: 'activities' } });
            }

        } catch (err) {
            console.error("Error creating activity:", err);
            setErrors({ submit: err.response?.data?.error || "Failed to create activity." });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'cost') {
            const regex = /^\d*(\.\d{0,2})?$/;

            if (!regex.test(value)) {
                return;
            }
        }
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const updateAttending = (selectedIds) => {
        console.log("Selected attending IDs:", selectedIds);
        setFormData(prev => ({
            ...prev,
            attending: selectedIds
        }));
    };

    return (
        <div className="create-activity-container">
            <h2>Add Activity</h2>
            <form onSubmit={handleSubmit} className="create-activity-form">
                {/* --- Basic Information --- */}
                <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                        <label>Activity Name *</label>
                        <input
                            type="text" name="name" value={formData.name}
                            placeholder="e.g. Six Flags" required onChange={handleChange}
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Type *</label>
                        <select name="activityType" value={formData.activityType} onChange={handleChange}>
                            <option value="Sightseeing">Sightseeing</option>
                            <option value="Dining">Dining</option>
                            <option value="Entertainment">Entertainment</option>
                            <option value="Shopping">Shopping</option>
                            <option value="Outdoor">Outdoor</option>
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
                            placeholder="info@activity.com" onChange={handleChange}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Website</label>
                    <input
                        type="url" name="website" value={formData.website}
                        placeholder="https://www.activity.com" onChange={handleChange}
                    />
                </div>

                {/* --- Dates and Confirmation --- */}
                <div className="form-row">
                    <div className="form-group">
                        <label>Activity Date *</label>
                        <input 
                            type="date"
                            name="activityDate"
                            value={formData.activityDate}
                            min={today}
                            required
                            onChange={handleChange} 
                        />
                        {errors.activityDate && <p className="error-text">{errors.activityDate}</p>}
                    </div>
                </div>

                {errors.activityDate && <p className="error-message">{errors.activityDate}</p>}

                <div className="form-row">
                    <div className="form-group">
                        <label>Start Time</label>
                        <input
                            type="time"
                            name="startTime"
                            value={formData.startTime}
                            onChange={handleChange}
                        />
                        {errors.startTime && <p className="error-text">{errors.startTime}</p>}
                    </div>
                    <div className="form-group">
                        <label>End Time</label>
                        <input
                            type="time"
                            name="endTime"
                            value={formData.endTime}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {errors.endTime && <p className="error-message">{errors.endTime}</p>}

                {/* --- Logistics --- */}

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
                </div>
                
                <div className="form-group">
                    <label>Attending</label>
                    <Select
                        options={collaboratorOptions}
                        value={
                            formData.attending ? formData.attending
                                .map(id => collaboratorOptions.find(option => String(option.value) === String(id)))
                                .filter(Boolean) 
                            : []
                        }
                        onChange={
                            (selectedOptions) => {
                                const selected = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                                updateAttending(selected);
                            }}
                        isMulti
                        placeholder="Who's Coming?"
                    />
                </div>

                <div className="form-group">
                    <label>Notes</label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        placeholder="Meeting details, things to bring, etc."
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