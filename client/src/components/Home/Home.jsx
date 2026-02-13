import { testApiCall, createExample, getExamples } from "../../example_services.jsx";

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

  return (
    <div>
        <h1>Pathways</h1>
        <p>Let's Get Going! 🌍</p>
        <button onClick={handleClick}>Test Button</button>
        <button onClick={handleAddExample}>Add Example</button>
        <button onClick={handleGetExamples}>Print Example</button>

    </div>
  )
}
export default Home