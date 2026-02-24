import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
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
          <li>
            <Link to="/account">Account</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
