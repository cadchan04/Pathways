import { useLocation, useNavigate, Link } from 'react-router-dom';
import React from 'react';

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

        const hoursPart = hours > 0 ? `${hours}h ` : "";
        const minutesPart = minutes > 0 ? `${minutes}m` : "";
        
        return (hoursPart + minutesPart).trim();
    };

    const layoverTime = (segment1, segment2) => {
        if (!segment1 || !segment2) return 0;

        const arrivalTime1 = new Date(segment1.arriveAt);
        const departureTime2 = new Date(segment2.departAt);

        const layoverMinutes = (departureTime2 - arrivalTime1) / (1000 * 60);
        return layoverMinutes > 0 ? layoverMinutes.toFixed(0) : 0;
    }


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
                            <span>Provider: </span> {(() => {
                                const providers = Array.isArray(leg.provider)
                                  ? leg.provider
                                  : (leg.provider ? [leg.provider] : []);
                                return providers.length > 0 ? providers.join(" → ") : "N/A";
                            })()}
                        </div>

                        <div className="leg-path-visual">
                            {leg.segments && leg.segments.length > 0 ? (
                                // MULTI-SEGMENT
                                leg.segments.map((seg, index) => {
                                    const prevSegment = index > 0 ? leg.segments[index - 1] : null;
                                    const transferMinutes = prevSegment ? layoverTime(prevSegment, seg) : null;
                                    return (
                                        <React.Fragment key={`seg-node-${index}`}>
                                            <div className="path-node">
                                                {/* If this is a transfer segment (not the first segment and has a layover), show transfer label and both times */}
                                                {transferMinutes !== null && (
                                                    <>
                                                        <span className="transfer-label">
                                                            {formatDuration(transferMinutes)} transfer
                                                        </span>
                                                        <span className="transfer-time">{formatTime(seg.arriveAt)} / {formatTime(seg.departAt)}</span>
                                                        <span className="path-address">{seg.origin.name}</span>
                                                    </>
                                                )}
                                                {transferMinutes === null && (
                                                    <>
                                                        <span className="path-time">{formatTime(seg.departAt)}</span>
                                                        <span className="path-address">{seg.origin.name}</span>
                                                    </>
                                                )}
                                            </div>

                                        <div className="path-connector">
                                            <span className="path-duration">{formatDuration(seg.duration)}</span>
                                            <div className="connector-line"></div>
                                        </div>

                                        {index === leg.segments.length - 1 && (
                                            <div className="path-node">
                                                <span className="path-time">{formatTime(seg.arriveAt)}</span>
                                                <span className="path-address">{seg.destination.name}</span>
                                            </div>
                                        )}
                                    </React.Fragment>
                                )})
                            ) : (
                                // FALLBACK: SINGLE LEG (No Segments)
                                <>
                                    <div className="path-node">
                                        <span className="path-time">{formatTime(leg.departAt)}</span>
                                        <span className="path-address">{leg.origin.name}</span>
                                    </div>

                                    <div className="path-connector">
                                        <span className="path-duration">{formatDuration(leg.duration)}</span>
                                        <div className="connector-line"></div>
                                        <span className="path-distance">{leg.distance} mi</span>
                                    </div>

                                    <div className="path-node">
                                        <span className="path-time">{formatTime(leg.arriveAt)}</span>
                                        <span className="path-address">{leg.destination.name}</span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className='leg-cost'> Cost: {leg.cost ? `$${leg.cost}` : 'Unknown'} </div>
                        <div className='leg-distance'> Distance: {leg.distance} mi </div>
                        <div className='leg-duration'> Duration: {formatDuration(leg.duration)} </div>
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

