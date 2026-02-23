import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getTrips } from '../../services/tripServices';
import { useUser } from '../../../context/UserContext';

import './MyTrip.css';

export default function MyTrip() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const { dbUser } = useUser();

  // Delete popup state
  const [showConfirm, setShowConfirm] = useState(false);
  const [tripToDelete, setTripToDelete] = useState(null);

  // Fetch trips
  useEffect(() => {
    const fetchTrips = async () => {
      if (!dbUser?._id) return;

      try {
        const data = await getTrips(dbUser._id);
        console.log("Fetched trips:", data);
        setTrips(data);

      } catch (err) {
        console.log("Error fetching trips:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTrips();
  });

  // Delete trip
  const deleteTrip = async (tripId) => {
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "DELETE"
      });

      // Remove from UI
      setTrips(prev => prev.filter(t => t._id !== tripId));
    } catch (err) {
      console.error("Error deleting trip: ", err);
    }
  }

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

                <div className="trip-actions">
                  <button
                    className="view-button"
                    onClick={() => navigate(`/view-details/${trip._id}`)}
                  >
                    View Details
                  </button>

                  <button
                    className="delete-button"
                    onClick={() => {
                    setTripToDelete(trip);
                    setShowConfirm(true);
                    }}
                  >
                    Delete
                  </button>
                </div>

              </div>
            ))
          ) : (
            <p>You haven't created any trips yet. Start planning your next adventure!</p>
          )}
        </div>
      )}

      <div className="my-trips-footer">
        <button className="create-button" onClick={() => navigate('/create-trip')}>Create New Trip +</button>
      </div>

      {/* Confirmation Popup */}
      {showConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }} >
          <div style={{ background: "white", padding: "20px", borderRadius: "8px", width: "300px", textAlign: "center" }} >
            <h3>Confirm Delete</h3>
            <p>Delete “{tripToDelete?.name}”?</p>

            <button style={{ background: "#e63946", color: "white", padding: "10px", border: "none", borderRadius: "6px", marginRight: "10px", cursor: "pointer" }} onClick={async () => {
                await deleteTrip(tripToDelete._id);
                setShowConfirm(false);
              }}
            >
              Confirm
            </button>

            <button style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "6px", cursor: "pointer" }} onClick={() => setShowConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}