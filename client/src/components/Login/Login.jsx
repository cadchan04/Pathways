import { useAuth0 } from "@auth0/auth0-react";
import "./Login.css";

export default function Login() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="login-container">
      <img 
        src="/images/Pathways.png" 
        alt="Pathways Logo" 
        className="login-logo"
      />

      <p className="login-slogan"><em><strong>Travel made simple.</strong></em></p>

      <button className="login-button" onClick={() => loginWithRedirect()}>
        Log In
      </button>
    </div>
  );
}
