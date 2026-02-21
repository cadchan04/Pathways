import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../components/Home/Home";
import MyTrip from "../components/Trip/MyTrip";
import Account from "../components/Account/Account";
import ProtectedRoute from "./ProtectedRoute";
import Callback from "../Callback";
import Login from "../components/Login/Login.jsx";
import CreateTrip from "../components/Trip/CreateTrip"
import TripDetails from "../components/Trip/TripDetails"
import CreateRoute from "../components/Route/CreateRoute/CreateRoute"
import RouteOptions from "../components/Route/RouteOptions/RouteOptions"

export default function AppRoutes() {
  return (
    <Routes>
      {/* Redirect root → login */}
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* Public routes - accessible without logging in */}
      <Route path="/login" element={<Login />} />             {/* LOGIN SHOULD BE PUBLIC */}
      <Route path="/callback" element={<Callback />} />       {/* Auth0 callback */}

      {/* Protected routes - login only */}
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/my-trips" element={<ProtectedRoute><MyTrip /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      <Route path="/create-trip" element={<ProtectedRoute><CreateTrip /></ProtectedRoute>} />
      <Route path="/view-details/:id" element={<ProtectedRoute><TripDetails /></ProtectedRoute>} />
      <Route path="/create-route" element={<ProtectedRoute><CreateRoute /></ProtectedRoute>} />
      <Route path="/route-options" element={<ProtectedRoute><RouteOptions /></ProtectedRoute>} />

      {/* 404 fallback */}
      <Route path="*" element={<h1>404: Page Not Found</h1>} />
    </Routes>
  );
}
