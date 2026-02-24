// import { useEffect } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import './RouteDetails.css';

export default function RouteDetails() {
    const { id } = useParams();

    return (
        <h2>Route Details ${id}</h2>
    )
}

