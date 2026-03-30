import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationToggle from '../NotificationToggle';
import './Profile.css'

function Account() {
  const { user, logout } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const [dbUser, setDbUser] = useState(null);

  useEffect(() => {
    if (!user?.sub) return;

    const fetchUser = async () => {
      const res = await fetch(`http://localhost:8080/api/user/${user.sub}`);
      const data = await res.json();
      setDbUser(data);
    };

    fetchUser();
  }, [user, location.state]);

  return (
    <section className="profile-page">
      <div>
      <h1>Profile</h1>
      </div>
      <p>View your account details.</p>

      <div className="profile-card">
        <div className="profile-field">
          <label><strong>Name</strong></label>
          <p>{dbUser?.name}</p>
        </div>

        <div className="profile-field">
          <label><strong>Email</strong></label>
          <p>{dbUser?.email}</p>
        </div>

        <div className="profile-field">
          <label><strong>Notifications</strong></label>
          <div className="notifications-button">
          <NotificationToggle userId={user.sub} />
          </div>
        </div>
      </div>

      <div className="profile-actions">
        <button onClick={() => navigate('/edit-profile')}>
          Edit Profile
        </button>

        <button
          className="logout-button"
          onClick={() =>
            logout({
              logoutParams: { returnTo: window.location.origin }
            })
          }
        >
          Log Out
        </button>
      </div>
    </section>
  )
}
export default Account