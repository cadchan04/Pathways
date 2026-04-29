import React, { useEffect, useMemo } from 'react';
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

const ROUTE_COLORS = ['#0066ff', '#1f8a4c', '#c96f12', '#8a3ffc', '#d43d51'];

// Helper component to auto-fit the map bounds to our markers
function MapBounds({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length === 1) {
      map.setView(bounds[0], 10);
    } else if (bounds && bounds.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  return null;
}

function getLocationLabel(location) {
  return location?.name || location?.address || 'Unknown Location';
}

function routeTitle(route) {
  const origin = getLocationLabel(route?.origin);
  const destination = getLocationLabel(route?.destination);
  return `${origin} to ${destination}`;
}

function samePosition(a, b) {
  return a?.[0] === b?.[0] && a?.[1] === b?.[1];
}

function idString(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  return String(value);
}

export default function RouteMap({ routes = [] }) {
  const mapData = useMemo(() => {
    const routeList = Array.isArray(routes) ? routes : [routes].filter(Boolean);
    if (routeList.length === 0) return null;

    const bounds = [];
    const routeLines = [];

    const buildPoint = (location, type, routeName) => {
      if (location?.coordinates?.lat != null && location?.coordinates?.lng != null) {
        return {
          position: [location.coordinates.lat, location.coordinates.lng],
          name: getLocationLabel(location),
          routeName,
          type,
        };
      }
      return null;
    };

    routeList.forEach((route, routeIndex) => {
      const routeName = route.name || routeTitle(route) || `Route ${routeIndex + 1}`;
      const points = [];

      const addPoint = (location, type) => {
        const point = buildPoint(location, type, routeName);
        if (point) points.push(point);
      };

      if (route.legs && route.legs.length > 0) {
        route.legs.forEach((leg, index) => {
          addPoint(leg.origin, index === 0 ? 'Origin' : 'Connection');
          addPoint(leg.destination, index === route.legs.length - 1 ? 'Destination' : 'Connection');
        });
      } else {
        addPoint(route.origin, 'Origin');
        addPoint(route.destination, 'Destination');
      }

      const uniquePoints = points.filter((point, index, list) => (
        index === 0 || !samePosition(point.position, list[index - 1].position)
      ));

      if (uniquePoints.length > 0) {
        uniquePoints.forEach((point) => bounds.push(point.position));
        routeLines.push({
          id: idString(route._id, `route-${routeIndex}`),
          name: routeName,
          color: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
          points: uniquePoints,
        });
      }
    });

    if (routeLines.length === 0) return null;
    return { routeLines, bounds };
  }, [routes]);

  // Acceptance Criteria: Fallback message when data cannot be loaded
  if (!mapData) {
    return (
      <div className="route-map-fallback">
        <p>Map data cannot be loaded for these routes.</p>
        <span className="fallback-details">Missing coordinate data for route origins or destinations.</span>
      </div>
    );
  }

  return (
    <div className="route-map-container">
      <MapContainer center={mapData.bounds[0]} zoom={10} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds bounds={mapData.bounds} />
        {mapData.routeLines.map((routeLine) => (
          <React.Fragment key={routeLine.id}>
            {routeLine.points.map((point, idx) => (
              <Marker key={`${routeLine.id}-${idx}`} position={point.position}>
                <Popup>
                  <strong>{point.type}:</strong> <br />
                  {point.name}
                  <br />
                  <span>{point.routeName}</span>
                </Popup>
              </Marker>
            ))}
            <Polyline
              positions={routeLine.points.map((point) => point.position)}
              color={routeLine.color}
              weight={3}
              opacity={0.55}
              dashArray="8 8"
            />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
