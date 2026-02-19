import { useEffect } from "react";
import { useAuth0 } from '@auth0/auth0-react';

function Home() {
  const { getAccessTokenSilently, isAuthenticated, user } = useAuth0();

  useEffect(() => {
    const syncUser = async () => {
      if (!isAuthenticated || !user) return;

      try {
        const token = await getAccessTokenSilently();

        await fetch("http://localhost:8080/api/user/sync", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sub: user.sub,
            email: user.email,
            name: user.name,
            picture: user.picture
          })
        });

        console.log("User synced successfully");
      } catch (err) {
        console.error("Error syncing user:", err);
      }
    };

    syncUser();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  return (
    <div>
      <h1>Pathways</h1>
      <p>Let's Get Going! 🌍</p>
    </div>
  );
}

export default Home;
