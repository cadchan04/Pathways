import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css'

function EditProfile() {
  const { user } = useAuth0();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!user?.sub) return;

    const fetchUser = async () => {
      const res = await fetch(`http://localhost:8080/api/user/${user.sub}`);
      const data = await res.json();
      setName(data.name);
      setNotificationEnabled(data.notificationEnabled);
    };

    fetchUser();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault()

    await fetch(`http://localhost:8080/api/user/${user.sub}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, notificationEnabled })
    })

    setSuccess('Profile updated successfully.')

    setTimeout(() => {
      navigate('/account', { state: { updated: true } })
    }, 1000)
  }

  return (
    <section className="profile-page">
      <h1>Edit Profile</h1>
      <p>Update your account information.</p>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-field">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {success && <p className="profile-success">{success}</p>}

        <button type="submit">Save Changes</button>
      </form>
    </section>
  )
}

export default EditProfile;