import { Routes, Route } from "react-router-dom"
import Home from "../pages/Home"
import MyTrip from "../pages/MyTrip"

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/my-trips" element={<MyTrip />} />
    </Routes>
  )
}
