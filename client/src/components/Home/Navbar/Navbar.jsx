import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth0();
  
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/" className="logo">
          Pathways {/* Can add logo here */}
        </Link>
      </div>
      <div className="navbar-right">
        <ul className="nav-links">
          <li>
            <Link to="/create-route">Route</Link>
          </li>
          <li>
            <Link to="/my-trips">My Trips</Link>
          </li>
        <li className="account-wrapper">
          <span className="account-link">
            Account
          </span>

          <div className="account-dropdown">
            <button onClick={() => navigate('/account')}>
              Profile
            </button>

            <button
              onClick={() =>
                logout({
                  logoutParams: { returnTo: window.location.origin }
                })
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
