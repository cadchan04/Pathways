import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import './MyTrip.css';

export default function MyTrip() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await axios.get('/api/trips');
        // const response = await fetch('/api/trips');

        // if (response.ok) {
        if (response.status == 200) {
          const data = response.data;
          // const data = await response.json();
          console.log("Fetched trips:", data);
          setTrips(data);
        }
      } catch (err) {
        console.log("Error fetching trips:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTrips();
  }, []);

  return (
    <div className="my-trips-container">
      <div className="my-trips-header">
        <h2>My Trips</h2>
      </div>
      
      {loading ? (
        <p>Loading your trips...</p>
      ) : (
        <div className="trips-list">
          {trips.length > 0 ? (
            trips.map((trip) => (
              <div key={trip._id} className="trip-row">
                <div className="trip-info">
                  <h3>{trip.name}</h3>
                  <p>{trip.description}</p>
                </div>

                <div className="trip-dates">
                  <div className="trip-dates">
                      <span>{trip.startDate ? new Date(trip.startDate).toLocaleDateString() : 'TBD'}</span>
                      <span> → </span>
                      <span>{trip.endDate ? new Date(trip.endDate).toLocaleDateString() : 'TBD'}</span>
                  </div>
                </div>

                <button className="view-btn" onClick={() => navigate(`/view-details/${trip._id}`)}>View Details</button>
              </div>
            ))
          ) : (
            <p>You haven't created any trips yet. Start planning your next adventure!</p>
          )}
        </div>
      )}

      <div className="my-trips-footer">
        <button className="create-btn" onClick={() => navigate('/create-trip')}>Create New Trip</button>
      </div>
    </div>
  )
}