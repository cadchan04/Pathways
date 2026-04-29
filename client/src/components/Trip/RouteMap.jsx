import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './RouteMap.css';

// Fix for default marker icons in Leaflet when using Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to auto-fit the map bounds to our markers
function MapBounds({ bounds }) {
  const map = useMap();
  if (bounds && bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
  return null;
}

export default function RouteMap({ route }) {
  const mapData = useMemo(() => {
    if (!route) return null;

    const points = [];
    const bounds = [];

    const addPoint = (location, type) => {
      if (location?.coordinates?.lat != null && location?.coordinates?.lng != null) {
        const pt = {
          position: [location.coordinates.lat, location.coordinates.lng],
          name: location.name || location.address || 'Unknown Location',
          type
        };
        points.push(pt);
        bounds.push(pt.position);
      }
    };

    // Extract origins and destinations from route legs if available
    if (route.legs && route.legs.length > 0) {
      route.legs.forEach((leg, index) => {
        if (index === 0) addPoint(leg.origin, 'Origin');
        else addPoint(leg.origin, 'Connection');
        
        if (index === route.legs.length - 1) addPoint(leg.destination, 'Destination');
        else addPoint(leg.destination, 'Connection');
      });
    } else {
      // Fallback to top-level route origin/destination
      addPoint(route.origin, 'Origin');
      addPoint(route.destination, 'Destination');
    }

    // Deduplicate consecutive identical points (e.g., a leg's destination is the next leg's origin)
    const uniquePoints = points.filter((pt, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return pt.position[0] !== prev.position[0] || pt.position[1] !== prev.position[1];
    });

    if (uniquePoints.length === 0) return null;
    return { points: uniquePoints, bounds };
  }, [route]);

  // Acceptance Criteria: Fallback message when data cannot be loaded
  if (!mapData) {
    return (
      <div className="route-map-fallback">
        <p>Map data cannot be loaded for this route.</p>
        <span className="fallback-details">Missing coordinate data for the origin or destination.</span>
      </div>
    );
  }

  return (
    <div className="route-map-container">
      <MapContainer center={mapData.points[0].position} zoom={10} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds bounds={mapData.bounds} />
        {mapData.points.map((point, idx) => (
          <Marker key={idx} position={point.position}>
            <Popup>
              <strong>{point.type}:</strong> <br />
              {point.name}
            </Popup>
          </Marker>
        ))}
        <Polyline positions={mapData.points.map(p => p.position)} color="#0066ff" weight={4} opacity={0.7} />
      </MapContainer>
    </div>
  );
}