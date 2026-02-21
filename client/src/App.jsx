import { useEffect } from "react";
import { useNavigate, BrowserRouter } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import AppRoutes from "./routes/AppRoutes";
import Navbar from "./components/Home/Navbar/Navbar";

function App() {
  // const { isAuthenticated, isLoading, loginWithRedirect, user } = useAuth0();
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/home");
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <AppRoutes />;
  }  

  return (
    <div>
      <Navbar />
      <main className="app-content">
        <AppRoutes />
          </main>
    </div>
  );
}

export default App;
