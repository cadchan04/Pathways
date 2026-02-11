import { testApiCall } from "../../services.jsx";

function Home() {
  const handleClick = async () => {
    console.log("Button clicked!")
    try {
      const data = await testApiCall()
      console.log("Success:", data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
        <h1>Pathways</h1>
        <p>Let's Get Going! 🌍</p>
        <button onClick={handleClick}>Test Button</button>
    </div>
  )
}
export default Home