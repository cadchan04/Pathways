import { useAuth0 } from '@auth0/auth0-react';

function Account() {
  const { logout } = useAuth0();
  return (
    <div>
        <h2>Account</h2>
        <p>You can change your account settings here. ⚙️</p>

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