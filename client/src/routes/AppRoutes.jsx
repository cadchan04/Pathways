import { Routes, Route } from "react-router-dom"
import Home from "../components/Home/Home"
import MyTrip from "../components/Trip/MyTrip"
import Account from "../components/Account/Account"
import CreateRoute from "../components/Route/CreateRoute/CreateRoute"
import RouteOptions from "../components/Route/RouteOptions/RouteOptions"

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create-route" element={<CreateRoute />} />
      <Route path="/route-options" element={<RouteOptions />} />
      <Route path="/my-trips" element={<MyTrip />} />
      <Route path="/account" element={<Account />} />

      <Route path="*" element={<h1>404: Page Not Found</h1>} />
    </Routes>
  )
}
