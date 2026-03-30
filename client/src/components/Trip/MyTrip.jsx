import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getTrips, duplicateTrip } from '../../services/tripServices';
import { useUser } from '../../../context/useUser';

import './MyTrip.css';

export default function MyTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dbUser } = useUser();

  // Menu State
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false); // delete popup state
  const [tripToDelete, setTripToDelete] = useState(null);

  // Fetch trips
  useEffect(() => {
    const fetchTrips = async () => {
      if (!dbUser?._id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getTrips(dbUser._id);
        setTrips(data);
        console.log("Fetched trips:", data);

        window.dispatchEvent(new Event('refreshNotifications'));
      } catch (err) {
        console.error("Error fetching trips:", err);
        setError("We couldn't load your trips right now. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchTrips();
  }, [dbUser?._id, location.key]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);

    if (activeMenuId) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenuId]);

  // Duplicate trip
  const handleDuplicateTrip = async (e, trip) => {
    e.stopPropagation(); // stop from triggering menu close too early
    const id =
      typeof trip._id === 'string' ? trip._id : trip._id?.$oid ?? String(trip._id);
    setDuplicatingId(id);
    try {
      await duplicateTrip(id);
      const data = await getTrips(dbUser._id);
      setTrips(data);

      window.dispatchEvent(new Event('refreshNotifications'));

    } catch (err) {
      console.error('Error duplicating trip:', err);
    } finally {
      setDuplicatingId(null);
    }
  };

  // Delete trip
  const handleDeleteTrip = async (tripId) => {
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: "DELETE"
      });

      // Remove from UI
      setTrips(prev => prev.filter(t => t._id !== tripId));

      window.dispatchEvent(new Event('refreshNotifications'));

    } catch (err) {
      console.error("Error deleting trip: ", err);
    }
  }

  const toggleMenu = (e, id) => {
    e.stopPropagation(); // prevent global click listener from closing it instantly
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  return (
    <div className="my-trips-container">
      <div className="my-trips-header">
        <h2>My Trips</h2>
      </div>
      
      {loading ? (
        <div className="loading-state">
          <p>Loading your trips...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p className="error-message">{error}</p>
        </div>
      ) : (
        <div className="trips-list">
          {trips.length > 0 ? (
            trips.map((trip) => {
              const tripIdStr =
                typeof trip._id === 'string' ? trip._id : trip._id?.$oid ?? String(trip._id);
              const isOpen = activeMenuId === tripIdStr;
              return (
                <div key={tripIdStr} className="trip-row">
                  <div className="trip-info">
                    <h3>{trip.name}</h3>
                    <p>{trip.description || "No description provided."}</p>
                  </div>

                  <div className="trip-dates">
                    <span>{trip.startDate ? new Date(trip.startDate).toLocaleDateString() : 'TBD'}</span>
                    <span> → </span>
                    <span>{trip.endDate ? new Date(trip.endDate).toLocaleDateString() : 'TBD'}</span>
                  </div>

                  <div className="trip-actions">
                    <button
                      type="button"
                      className="view-button"
                      onClick={() => navigate(`/view-trip-details/${tripIdStr}`)}
                    >
                      View Details
                    </button>

                    {/* Three Dots Menu */}
                    <div className="more-options-container">
                      <button
                        className="three-dots-button"
                        onClick={(e) => toggleMenu(e, tripIdStr)}
                        >
                          ⋮
                        </button>

                        {isOpen && (
                          <div className="options-dropdown">
                            <button
                              type="button"
                              className="duplicate-trip-button"
                              disabled={duplicatingId !== null}
                              onClick={(e) => {
                                handleDuplicateTrip(e, trip); // pass 'e' to stop propagation
                                setActiveMenuId(null);
                              }}
                            >
                              {duplicatingId === tripIdStr ? 'Duplicating…' : 'Duplicate'}
                            </button>

                            <button
                              type="button"
                              className="delete-trip-button"
                              onClick={(e) => {
                                e.stopPropagation(); // keep the menu/row logic from firing
                                setTripToDelete(trip);
                                setShowConfirm(true);
                                setActiveMenuId(null);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                  </div>
                </div>
              );
            })
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
                await handleDeleteTrip(tripToDelete._id);
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
  );
}