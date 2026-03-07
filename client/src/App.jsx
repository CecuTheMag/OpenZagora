/**
 * Open Zagora - Main Application Component
 * 
 * This is the root component that sets up React Router navigation
 * and renders the main layout with navbar and page routes.
 */

import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import MapPage from './pages/MapPage'
import BudgetPage from './pages/BudgetPage'
import CouncilPage from './pages/CouncilPage'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation bar - visible on all pages */}
      <Navbar />
      
      {/* Main content area with page routing */}
      <main className="container mx-auto px-4 py-8">
        <Routes>
          {/* Home/Dashboard page */}
          <Route path="/" element={<Home />} />
          
          {/* Interactive project map */}
          <Route path="/map" element={<MapPage />} />
          
          {/* Budget visualization */}
          <Route path="/budget" element={<BudgetPage />} />
          
          {/* Council vote tracker */}
          <Route path="/council" element={<CouncilPage />} />
        </Routes>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-600 text-sm">
              © 2024 Open Zagora. Municipal Transparency Dashboard.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-500 hover:text-primary-600 text-sm">
                About
              </a>
              <a href="#" className="text-gray-500 hover:text-primary-600 text-sm">
                API Documentation
              </a>
              <a href="#" className="text-gray-500 hover:text-primary-600 text-sm">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
