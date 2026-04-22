import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../components/Home/Home";
import MyTrip from "../components/Trip/MyTrip";
import Account from "../components/Account/Account";
import ProtectedRoute from "./ProtectedRoute";
import Callback from "../Callback";
import Login from "../components/Login/Login.jsx";
import CreateTrip from "../components/Trip/CreateTrip"
import EditTrip from "../components/Trip/EditTrip.jsx";
import TripDetails from "../components/Trip/TripDetails"
import CreateRoute from "../components/Route/CreateRoute/CreateRoute"
import RouteOptions from "../components/Route/RouteOptions/RouteOptions"
import RouteDetails from "../components/Route/RouteDetails/RouteDetails.jsx";
import EditProfile from "../components/Account/EditProfile.jsx";
import InvitationsPage from "../components/Invitations/InvitationsPage.jsx";
import CreateAccommodation from "../components/Accommodation/CreateAccommodation.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Redirect root → login */}
      <Route path="/" element={<Navigate to="/my-trips" replace />} />

      {/* Public routes - accessible without logging in */}
      <Route path="/login" element={<Login />} />             {/* LOGIN SHOULD BE PUBLIC */}
      <Route path="/callback" element={<Callback />} />       {/* Auth0 callback */}

      {/* Protected routes - login only */}
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/my-trips" element={<ProtectedRoute><MyTrip /></ProtectedRoute>} />
      <Route path="/invitations" element={<ProtectedRoute><InvitationsPage /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      <Route path="/create-trip" element={<ProtectedRoute><CreateTrip /></ProtectedRoute>} />
      <Route path="/edit-trip/:id" element={<ProtectedRoute><EditTrip /></ProtectedRoute>} />
      <Route path="/view-trip-details/:id" element={<ProtectedRoute><TripDetails /></ProtectedRoute>} />
      <Route path="/create-route" element={<ProtectedRoute><CreateRoute /></ProtectedRoute>} />
      <Route path="/route-options" element={<ProtectedRoute><RouteOptions /></ProtectedRoute>} />
      <Route path="/view-route-details" element={<ProtectedRoute><RouteDetails /></ProtectedRoute>} />
      <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
      <Route path="/add-accommodation/:tripId" element={<ProtectedRoute><CreateAccommodation /></ProtectedRoute>} />

      {/* 404 fallback */}
      <Route path="*" element={<h1>404: Page Not Found</h1>} />
    </Routes>
  );
}
