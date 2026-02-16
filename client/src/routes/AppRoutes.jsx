import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../components/Home/Home";
import MyTrip from "../components/Trip/MyTrip";
import Account from "../components/Account/Account";
import ProtectedRoute from "./ProtectedRoute";
import Callback from "../Callback";
import Login from "../components/Login/Login.jsx";
import CreateTrip from "../components/Trip/CreateTrip"

export default function AppRoutes() {
  return (
    <Routes>
      {/* Redirect root → login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/" element={<Home />} />
      <Route path="/account" element={<Account />} />
      <Route path="/my-trips" element={<MyTrip />} />
      <Route path="/create-trip" element={<CreateTrip />} />

      {/* Auth0 callback */}
      <Route path="/callback" element={<Callback />} />

      {/* LOGIN SHOULD BE PUBLIC */}
      <Route path="/login" element={<Login />} />

      {/* PROTECTED ROUTES */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-trips"
        element={
          <ProtectedRoute>
            <MyTrip />
          </ProtectedRoute>
        }
      />

      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        }
      />

      {/* 404 fallback */}
      <Route path="*" element={<h1>404: Page Not Found</h1>} />
    </Routes>
  );
}
