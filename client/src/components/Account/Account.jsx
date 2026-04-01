import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import NotificationToggle from '../NotificationToggle';
import { useUser } from '../../../context/useUser';
import './Profile.css'

function Account() {
  const { user, logout } = useAuth0();
  const navigate = useNavigate();
  const { dbUser } = useUser();

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