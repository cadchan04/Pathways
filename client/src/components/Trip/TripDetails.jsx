import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTripById } from '../../services/tripServices';

import './TripDetails.css';


export default function TripDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTripDetails = async () => {
            try {
                const data = await getTripById(id);
                console.log("Fetched trip data:", data);
                setTrip(data);

            } catch (error) {
                console.error("Error fetching trip details:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchTripDetails();
    }, [id]);

    if (loading) {
        return (
            <div className="details-container">
                <p>Loading trip details...</p>
            </div>
        )
    }

    if (!trip) {
        return (
            <div className="details-container">
                <p>Trip not found.</p>
            </div>
        )
    }

    const formatDate = (dateObj) => {
    const dateString = dateObj?.$date || dateObj; // check if the date is a nested $date object or a direct string
    if (!dateString) return 'MM/DD';
    
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

    return (
        <div className="details-container">
            <button className="back-btn" onClick={() => navigate('/my-trips')}>← Back to My Trips</button>
            
            <div className="details-header">
                <h1>{trip.name}</h1>
                <p className="trip-desc">{trip.description}</p>
                <div className="trip-dates">{new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}</div>
            </div>

            <div className="details-content">
                <h2>Routes</h2>
                {trip.routes && trip.routes.length > 0 ? (
                    <div className="routes-list">
                        {trip.routes.map((route, index) => (
                            <div key={index} className="route-row">
                                {/* date circle on the left */}
                                <div className="route-date-circle">
                                    {formatDate(route.departAt)}
                                </div>

                                {/* route card on the right */}
                                <div className="route-card">
                                    <div className="route-info">
                                        <h3>{route.name}</h3>
                                        <p>
                                            {route.origin?.name || "Unknown Origin"} to {route.destination?.name || "Unknown Destination"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No routes added to this trip yet.</p>
                )}
            </div>
        </div>
    )
}