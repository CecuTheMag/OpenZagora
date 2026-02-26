/**
 * Map Page
 * 
 * Interactive map showing municipal projects using Leaflet.
 * Displays project markers with popups containing project details.
 */

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import axios from 'axios'
import { 
  MapPin, 
  Filter, 
  Search,
  Building,
  DollarSign,
  Calendar,
  Info
} from 'lucide-react'
import L from 'leaflet'

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Fix Leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom marker icons for different statuses
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  })
}

const statusColors = {
  planned: '#f59e0b',   // amber-500
  active: '#3b82f6',    // blue-500
  completed: '#22c55e', // green-500
  cancelled: '#ef4444'  // red-500
}

function MapPage() {
  const [projects, setProjects] = useState([])
  const [filteredProjects, setFilteredProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Stara Zagora coordinates
  const defaultCenter = [42.4257, 25.6344]
  const defaultZoom = 13

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [])

  // Filter projects when filters change
  useEffect(() => {
    let filtered = projects

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.contractor?.toLowerCase().includes(query)
      )
    }

    setFilteredProjects(filtered)
  }, [projects, statusFilter, searchQuery])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_URL}/projects?limit=1000`)
      // Only show projects with coordinates
      const projectsWithCoords = (response.data.data || []).filter(
        p => p.lat && p.lng
      )
      setProjects(projectsWithCoords)
      setFilteredProjects(projectsWithCoords)
      setError(null)
    } catch (err) {
      console.error('Error fetching projects:', err)
      setError('Failed to load projects. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: 'BGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Get status badge style
  const getStatusBadge = (status) => {
    const classes = {
      planned: 'status-planned',
      active: 'status-active',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    }
    return classes[status] || 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchProjects}
          className="mt-4 btn-primary"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Map</h1>
          <p className="text-gray-600 mt-1">
            Explore municipal projects across Stara Zagora
          </p>
        </div>
        
        {/* Stats */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span>{projects.filter(p => p.status === 'completed').length} Completed</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span>{projects.filter(p => p.status === 'active').length} Active</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
            <span>{projects.filter(p => p.status === 'planned').length} Planned</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-40"
            >
              <option value="all">All Status</option>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mt-3">
          Showing {filteredProjects.length} of {projects.length} projects
        </p>
      </div>

      {/* Map Container */}
      <div className="card p-0 overflow-hidden">
        <div className="h-[600px] w-full">
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {filteredProjects.map((project) => (
              <Marker
                key={project.id}
                position={[parseFloat(project.lat), parseFloat(project.lng)]}
                icon={createCustomIcon(statusColors[project.status] || '#6b7280')}
              >
                <Popup>
                  <div className="p-2 min-w-[250px]">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">
                      {project.title}
                    </h3>
                    
                    <span className={getStatusBadge(project.status)}>
                      {project.status}
                    </span>
                    
                    {project.description && (
                      <p className="text-sm text-gray-600 mt-3 line-clamp-3">
                        {project.description}
                      </p>
                    )}
                    
                    <div className="mt-3 space-y-2 text-sm">
                      {project.budget && (
                        <div className="flex items-center text-gray-700">
                          <DollarSign className="h-4 w-4 mr-2 text-secondary-600" />
                          <span className="font-medium">
                            {formatCurrency(project.budget)}
                          </span>
                        </div>
                      )}
                      
                      {project.contractor && (
                        <div className="flex items-center text-gray-700">
                          <Building className="h-4 w-4 mr-2 text-primary-600" />
                          <span>{project.contractor}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center text-gray-700">
                        <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                        <span>
                          {formatDate(project.start_date)}
                          {project.end_date && ` - ${formatDate(project.end_date)}`}
                        </span>
                      </div>
                    </div>

                    {project.citizen_votes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-600 font-medium">
                            👍 {project.citizen_votes.for || 0}
                          </span>
                          <span className="text-red-600 font-medium">
                            👎 {project.citizen_votes.against || 0}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Project List (Mobile-friendly alternative) */}
      <div className="card lg:hidden">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Project List</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredProjects.map((project) => (
            <div 
              key={project.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {project.title}
                  </h3>
                  <span className={getStatusBadge(project.status)}>
                    {project.status}
                  </span>
                </div>
                <MapPin className="h-5 w-5 text-gray-400" />
              </div>
              
              {project.budget && (
                <p className="text-sm text-gray-600 mt-2">
                  Budget: {formatCurrency(project.budget)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-3">
          <Info className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Map Legend</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow mr-2"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow mr-2"></div>
            <span>Active</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow mr-2"></div>
            <span>Planned</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow mr-2"></div>
            <span>Cancelled</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MapPage
