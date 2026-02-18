import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './TripDetails.css';

export default function TripDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTripDetails = async () => {
            try {
                const response = await axios.get(`/api/trips/${id}`);

                if (response.status == 200) {
                    const data = response.data;
                    
                    // TODO: TEMPORARY - hardcoded route for testing
                    data.routes = [
                        {
                            _id: "mock_route_001",
                            name: "Direct Flight to Chicago",
                            startDate: data.startDate,
                            endDate: data.endDate,
                            origin: "Los Angeles (LAX)",
                            destination: "Chicago (ORD)",
                        },
                        {
                            _id: "mock_route_002",
                            name: "Uber to Hotel",
                            startDate: data.startDate,
                            endDate: data.endDate,
                            origin: "O'Hare Airport",
                            destination: "The Gwen Hotel",
                        }
                    ]

                    console.log("Fetched trip - name:", data.name);
                    console.log("Fetched trip routes:", data.routes);

                    setTrip(data);
                }
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

    console.log("Trip name stored:", trip.name);
    console.log("Trip description stored:", trip.description);
    console.log("Trip routes stored:", trip.routes);

    const formatDate = (dateString) => {
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
                                    {formatDate(route.startDate)}
                                </div>

                                {/* route card on the right */}
                                <div className="route-card">
                                    <div className="route-info">
                                        <h3>{route.name}</h3>
                                        {/* <div className="route-dates">{new Date(route.startDate).toLocaleDateString()} - {new Date(route.endDate).toLocaleDateString()}</div> */}
                                        <p>{route.origin} to {route.destination}</p>
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