import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

function Account() {
  const { user, logout } = useAuth0();
  const [notificationPreference, setNotificationPreference] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/user/${user.sub}`);
        const data = await res.json();
        setNotificationPreference(data.notificationEnabled);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUser();
  }, [user]);

  return (
    <div>
        <h2>Account</h2>
        {/* <p>You can change your account settings here. ⚙️</p> */}
        <div>
          <p><strong>Name:</strong> {user?.name}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p>
            <strong>Notifications:</strong>{' '}
            {notificationPreference ? 'On' : 'Off'}
          </p>
        </div>

        <button onClick={() =>
          logout({
            logoutParams: { returnTo: window.location.origin }
          })
        }
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "200px",
          padding: "12px",
          backgroundColor: "#348ea8", /* navbar color */
          color: "white",
          border: "none",
          borderRadius: "6px",
          fontSize: "16px",
          cursor: "pointer"
        }}
      >
        Log Out
      </button>
    </div>
  )
}
export default Account