import { BrowserRouter } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import AppRoutes from "./routes/AppRoutes";
import Navbar from "./components/Home/Navbar/Navbar";
import { UserProvider } from "../context/UserContext";

function App() {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <AppRoutes />;
  }  

  return (
    <div>
      <UserProvider>
        <Navbar />
        <main className="app-content">
          <AppRoutes />
        </main>
      </UserProvider>
    </div>
  );
}

export default App;
