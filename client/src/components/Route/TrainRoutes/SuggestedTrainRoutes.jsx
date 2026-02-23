import React, { useState } from 'react';
import { getTrainOptions } from '../../../services/trainServices';
import './SuggestedTrainRoutes.css';

export default function SuggestedTrainRoutes() {
    const [searchData, setSearchData] = useState({
        origin: '',
        destination: '',
        departureTime: ''
    });
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // convert local datetime-local value to ISO string for Google API
            const formattedDate = new Date(searchData.departureTime).toISOString();

            const data = await getTrainOptions({ 
                ...searchData, 
                departureTime: formattedDate 
            });

            setRoutes(data);
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setLoading(false);
        }
    }

    const formatTime = (isoString) => {
        if (!isoString) return "N/A";
        return new Date(isoString).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
            // hour12: false
        });
    };

    return (
        <div className="suggested-routes-container">
            <section className="search-section">
                <h2>Find Train Routes</h2>
                <form onSubmit={handleSearch} className="search-form">
                    <input
                        type="text"
                        placeholder="Origin (e.g. Seattle)"
                        required
                        onChange={(e) => setSearchData({...searchData, origin: e.target.value})}
                    />

                    <input
                        type="text"
                        placeholder="Destination (e.g. Los Angeles)"
                        required
                        onChange={(e) => setSearchData({...searchData, destination: e.target.value})}
                    />

                    <input
                        type="datetime-local"
                        required
                        onChange={(e) => setSearchData({...searchData, departureTime: e.target.value})}
                    />

                    <button type="submit" disabled={loading}>
                        {loading ? 'Searching...' : 'Find Trains'}
                    </button>
                </form>
            </section>

            <section className="results-section">
                {routes.length > 0 ? (
                    <div className="routes-list">
                        <p>{routes.length} routes found (Sorted by Duration).</p>
                        {routes.map((route, index) => {
                            console.log(`Route Options ${index + 1}:`, route);

                            const firstLeg = route.legs?.[0];
                            const transitStep = firstLeg?.steps?.find(step => step.transitDetails);
                            const details = transitStep?.transitDetails;
                            
                            // const fare = route.travelAdvisory?.transitFare;
                            const localizedFare = route.localizedValues?.transitFare;

                            const transitSteps = route.legs?.[0]?.steps?.filter(step => step.transitDetails) || [];
                            const transferCount = transitSteps.length - 1;
                            const stopText = transferCount <= 0 ? "Direct" : `${transferCount} transfer${transferCount > 1 ? 's' : ''}`;

                            return (
                                <div key={index} className="route-card">
                                    <div className="route-card-header">
                                        <span className="price-tag">
                                            {/* {fare && fare.currencyCode && fare.units
                                                ? `${fare.currencyCode} $${fare.units}` 
                                                : (typeof localizedFare === 'string' ? localizedFare : 'N/A')} */}
                                            {localizedFare?.text ? localizedFare.text : "N/A"}
                                        </span>
                                    </div>

                                    <div className="time-block">
                                        <strong>{formatTime(details?.stopDetails?.departureTime)}</strong>
                                        <p>{new Date(details?.stopDetails?.departureTime).toLocaleDateString()}</p>
                                        <p>{details?.stopDetails?.departureStop?.name || "Origin Station"}</p>
                                    </div>
                                    
                                    <div className="duration-arrow">
                                        <span>
                                            {route.duration ? (() => {
                                                // convert seconds to total minutes
                                                const totalMinutes = Math.round(parseInt(route.duration.replace('s', '')) / 60);
                                                const h = Math.floor(totalMinutes / 60);
                                                const m = totalMinutes % 60;

                                                const hoursPart = h > 0 ? `${h} hr` : "";
                                                const minutesPart = m > 0 ? `${m} min` : "";

                                                // join with 'and' only if both exist, otherwise return whichever is present
                                                return [hoursPart, minutesPart].filter(Boolean).join(' ') || "0 min";
                                            })() : "N/A"}
                                        </span>
                                        <hr />
                                        <span className="stop-count">{stopText}</span>
                                    </div>

                                    <div className="time-block">
                                        <strong>{formatTime(details?.stopDetails?.arrivalTime)}</strong>
                                        <p>{new Date(details?.stopDetails?.arrivalTime).toLocaleDateString()}</p>
                                        <p>{details?.stopDetails?.arrivalStop?.name || "Destination Station"}</p>
                                    </div>

                                    <div className="route-meta">
                                        <p><strong>Train:</strong> {details?.transitLine?.name || "Amtrak"}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    !loading && <p className="placeholder-text">Enter details to see suggested train routes.</p>
                )}
            </section>
        </div>
    )
}