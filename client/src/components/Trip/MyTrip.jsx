import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MyTrip() {
  const navigate = useNavigate();

  return (
    <div>
        <h2>My Trips</h2>
        <p>Here are all your trips! 🧳</p>
        <button onClick={() => navigate('/create-trip')}>Create New Trip</button>
    </div>
  )
}