import { testApiCall, createExample, getExamples } from "../../example_services.jsx";
import { getRoutes, updateLeg, getLegs } from "../../services/routeServices.js";

function Home() {
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

  // GET ROUTES TEST - replace with actual trip ID when integrated with choosing a trip to view
  const handleGetRoutes = async () => {
    try {
      const routes = await getRoutes("699372005537e006fcc02660")
      console.log("Routes for Trip:", routes)
    } catch (err) {
      console.error(err)
    }
  }

  // Update leg test
  const handleUpdateLeg = async () => {
    try {
      // The req body has to have the same name as the field in the schema that needs to be updated
      const routeId = await getRoutes("699372005537e006fcc02660").then(routes => routes[0]._id) // get the first route's ID for testing
      const legId = await getLegs("699372005537e006fcc02660", routeId).then(legs => legs[0]._id) // get the first leg's ID for testing
      //const updatedLeg = await updateLeg("699372005537e006fcc02660", routeId, legId, { "origin.name": "San Jose, CA" })
      //const updatedLeg = await updateLeg("699372005537e006fcc02660", routeId, legId, { cost: 67 })
      const updatedLeg = await updateLeg("699372005537e006fcc02660", routeId, legId, { cost: 50, duration: 160 })
      
      console.log("Updated Leg:", updatedLeg)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
        <h1>Pathways</h1>
        <p>Let's Get Going! 🌍</p>
        <button onClick={handleClick}>Test Button</button>
        <button onClick={handleAddExample}>Add Example</button>
        <button onClick={handleGetExamples}>Print Example</button>
        <button onClick={handleGetRoutes}>Print Routes</button>
        <button onClick={handleUpdateLeg}>Test Update Leg</button>
    </div>
  )
}
export default Home