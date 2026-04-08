import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useUser } from '../../../../context/useUser';
import { getTrips } from '../../../services/tripServices';
import { listMyInvitations } from '../../../services/invitationServices';
import './Navbar.css';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth0();
  const { dbUser } = useUser();

  const [notifications, setNotifications] = useState([]);
  const [inviteCount, setInviteCount] = useState(0);
  const [openNotifications, setOpenNotifications] = useState(false);
  const notifRef = useRef();

  // Fetch upcoming trips for dropdown
  // Inside your navbar or bell component
  const fetchUpcoming = async () => {
    try {
      const data = await getTrips(dbUser._id);
      console.log('Fetched trips for notifications:', data);

      const now = Date.now(); // milliseconds
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      const upcomingTrips = data
        .filter(trip => {
          const tripStart = new Date(trip.startDate).getTime();
          return tripStart - now <= ONE_DAY_MS && tripStart - now >= 0;
        })
        .map(trip => ({
          title: `${trip.name} in < 1 day`,
          body: `Starts: ${new Date(trip.startDate.split('T')[0] + 'T00:00').toLocaleDateString()}`,          url: `/view-trip-details/${trip._id}`,
        }));

        const priceAlerts = data.flatMap(trip =>
          (trip.priceAlerts || [])
            .filter(alert => !alert.read)
            .map((alert) => ({
              title: `💰 Price Change: ${trip.name}`,
              body: alert.message,
              url: `/view-trip-details/${trip._id}`,
              tripId: trip._id,
              alertId: alert._id
            }))
        );

      setNotifications([...priceAlerts, ...upcomingTrips]);
    } catch (err) {
      console.error('Error fetching trips for notifications:', err);
    }
  };

  const dismissAlert = async (tripId, alertId) => {
    if (!dbUser?._id) return;
    try {
      await axios.patch(`${API_URL}/api/trips/${tripId}/alerts/${alertId}/read`, null, {
        params: { userId: dbUser._id },
      });
      fetchUpcoming();
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  const fetchInviteCount = async () => {
    if (!dbUser?._id) {
      setInviteCount(0);
      return;
    }
    try {
      const data = await listMyInvitations(dbUser._id);
      setInviteCount(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      console.error('Error fetching invitations count:', err);
      setInviteCount(0);
    }
  };

  useEffect(() => {
    if (!dbUser?._id) return;
  
    fetchUpcoming();
  }, [dbUser?._id, location.pathname]);

  useEffect(() => {
    if (!dbUser?._id) return;
    fetchInviteCount();
  }, [dbUser?._id, location.pathname]);

  useEffect(() => {
    const handleRefresh = () => fetchUpcoming();
    window.addEventListener('refreshNotifications', handleRefresh);
    return () => window.removeEventListener('refreshNotifications', handleRefresh);
  }, [dbUser?._id]);

  useEffect(() => {
    const onInvitesChanged = () => fetchInviteCount();
    window.addEventListener('invitationsChanged', onInvitesChanged);
    return () => window.removeEventListener('invitationsChanged', onInvitesChanged);
  }, [dbUser?._id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = e => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setOpenNotifications(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="logo">Pathways</Link>
      </div>

      <div className="navbar-right">
        <ul className="nav-links">
          <li>
            <Link to="/create-route">Route</Link>
          </li>
          <li>
            <Link to="/my-trips">My Trips</Link>
          </li>
          <li className="nav-invitations-item">
            <Link to="/invitations" className="nav-invitations-link">
              Invitations
              {inviteCount > 0 && (
                <span className="nav-invitations-badge">{inviteCount}</span>
              )}
            </Link>
          </li>

          {/* Notifications Bell */}
          <li className="account-wrapper">
            <span className="account-link white-bell">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="white"
              viewBox="0 0 24 24"
            >
              <path d="M12 24c1.104 0 2-.896 2-2h-4c0 1.104.896 2 2 2zm6.364-6c-.001-.001-.001-.002-.002-.003L18 16V11c0-3.314-2.686-6-6-6s-6 2.686-6 6v5l-.362 1.997c-.001.001-.001.002-.002.003C5.257 18.148 5 18.557 5 19v1h14v-1c0-.443-.257-.852-.636-1z"/>
            </svg>
            {notifications.length > 0 && (
              <span className="badge">{notifications.length}</span>
            )}
          </span>
          <div className="account-dropdown notifications-dropdown">
          {notifications.map((n, i) => (
  <div key={i} className="notification-item">
    <button className="notification-btn" onClick={() => navigate(n.url)}>
      {n.title}<br/>
      <span style={{ fontSize: '0.85rem', color: '#555' }}>{n.body}</span>
    </button>
    {n.alertId !== undefined && (
  <button
    className="dismiss-btn"
    onClick={(e) => {
      e.stopPropagation();
      dismissAlert(n.tripId, n.alertId);
    }}
  >
    ✕
  </button>
)}
  </div>
))}
          </div>
        </li>

          {/* Account */}
          <li className="account-wrapper">
            <span className="account-link">Account</span>
            <div className="account-dropdown">
              <button onClick={() => navigate('/account')}>Profile</button>
              <button
                onClick={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }
              >
                Log Out
              </button>
            </div>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;