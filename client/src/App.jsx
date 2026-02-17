import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import Navbar from './components/Home/Navbar/Navbar'

// import { useState } from 'react'
import './App.css'

function App() {
  return (
    <div>
      <BrowserRouter>
        <Navbar />
        <main className="app-content">
          <AppRoutes />
        </main>
      </BrowserRouter>
    </div>
  )
}

export default App
