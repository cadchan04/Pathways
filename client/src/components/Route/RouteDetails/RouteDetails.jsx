import { useLocation, useNavigate, Link } from 'react-router-dom';

import './RouteDetails.css';

export default function RouteDetails() {
    const location = useLocation();
    const navigate = useNavigate();

    const route = location.state?.selectedRoute;

    const formatTime = (isoString) => {
        if (!isoString) return "N/A";
        return new Date(isoString).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (totalMinutes) => {
        if (!totalMinutes || totalMinutes <= 0) return "0 min";
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        const hoursPart = hours > 0 ? `${hours} hr ` : "";
        const minutesPart = minutes > 0 ? `${minutes} min` : "";
        
        return (hoursPart + minutesPart).trim();
    };


    if (!route) {
        return <p>No route selected. Please <Link to="/create-route">search again</Link>.</p>
    }

    return (
        <div className="route-details-page">
            <div className="route-details-header">
                <h2>Itinerary: {route.name}</h2>
            </div>

            <div className="route-summary-banner">
                <div className="summary-stat">
                    <strong>Total Duration: </strong>
                    <span>{formatDuration(route.totalDuration)}</span>
                </div>
                <div className="summary-stat">
                    <strong>Total Cost: </strong>
                    <span>{route.totalCost > 0 ? `$${route.totalCost}` : "Unknown"}</span>
                </div>
                <div className="summary-stat">
                    <strong>Total Distance: </strong>
                    <span>{route.totalDistance || 0} miles</span>
                </div>
            </div>

            <div className="route-details-legs">
                {route.legs.map((leg, index) => (
                    <div key={index} className="leg-detail-card">
                        <div className="leg-header">
                            <h3>Leg {index + 1}: {leg.transportationMode}</h3>
                            <span className="leg-provider">{leg.provider}</span>
                        </div>

                        <div className="leg-path-visual">
                            <div className="path-node">
                                <span className="path-time">{formatTime(leg.departAt)}</span>
                                <span className="path-address">{leg.origin.address}</span>
                            </div>

                            <div className="path-connector">
                                <span className="path-duration">{formatDuration(leg.duration)}</span>
                                <div className="connector-line"></div>
                                <span className="path-distance">{leg.distance} mi</span>
                            </div>

                            <div className="path-node">
                                <span className="path-time">{formatTime(leg.arriveAt)}</span>
                                <span className="path-address">{leg.destination.address}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="route-details-footer">
                <button className="back-button" onClick={() => navigate(-1)}>
                    ← Back to Suggestions
                </button>
            </div>
        </div>
    )
}

