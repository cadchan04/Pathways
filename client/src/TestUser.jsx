import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function TestUser() {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const test = async () => {
      try {
        const token = await getAccessTokenSilently({
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,   // ⭐ REQUIRED
          scope: "openid profile email"
        });

        const res = await fetch("http://localhost:8080/api/user/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`   // ⭐ VALID TOKEN NOW
          },
          body: JSON.stringify({
            sub: user.sub,
            email: user.email,
            name: user.name,
            picture: user.picture
          })
        });

        const serverUser = await res.json();
        console.log("CLIENT RECEIVED USER:", serverUser);
      } catch (err) {
        console.error("SYNC ERROR:", err);
      }
    };

    test();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  return null;
}
