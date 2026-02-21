import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { testApiCall, createExample, getExamples } from "../../example_services.jsx";

function Home() {
  const { getAccessTokenSilently, isAuthenticated, user, isLoading } = useAuth0();

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

  if (isLoading) return <p>Loading...</p>;

  // CAN DELETE THIS - just here to show how to call the backend API from the frontend
  const handleClick = async () => {
    console.log("Button clicked!")
    try {
      const data = await testApiCall()
      console.log("Success:", data)
    } catch (err) {
      console.error(err)
    }
  }

  // CAN DELETE THIS - showing adding data to database
  const handleAddExample = async () => {
    try {
      const newExample = await createExample("New Example", 123)
      console.log("New Example:", newExample)
    } catch (err) {
      console.error(err)
    }
  }

  // CAN DELETE THIS - showing getting data from database
  const handleGetExamples = async () => {
    try {
      const examples = await getExamples()
      console.log("Examples:", examples)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <h1>Pathways</h1>
      <p>Let's Get Going! 🌍</p>

      {isAuthenticated && (
        <div>
          <p>Name: {user.name}</p>
          <p>Email: {user.email}</p>
          <img src={user.picture} alt="profile" width={80} />
        </div>
      )}
        <h1>Pathways</h1>
        <p>Let's Get Going! 🌍</p>
        <button onClick={handleClick}>Test Button</button>
        <button onClick={handleAddExample}>Add Example</button>
        <button onClick={handleGetExamples}>Print Example</button>

    </div>
  );
}

export default Home;
