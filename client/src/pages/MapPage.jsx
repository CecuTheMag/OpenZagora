/**
 * Map Page
 * 
 * Interactive map showing municipal projects and OSM data using Leaflet.
 * Displays markers from multiple sources: EOP (public procurement) and OSM (points of interest).
 * Auto-refreshes data periodically.
 */

import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import axios from 'axios'
import { 
  MapPin, 
  Filter, 
  Search,
  Building,
  DollarSign,
  Calendar,
  Info,
  RefreshCw,
  Layers
} from 'lucide-react'
import L from 'leaflet'

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
console.log('API_URL configured as:', API_URL)

// Auto-refresh interval in milliseconds (5 minutes)
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

// Fix Leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom marker icons for different statuses/types
const createCustomIcon = (color, size = 24) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  })
}

// Color schemes for different data sources and types
const colors = {
  // EOP status colors
  eop: {
    planned: '#f59e0b',   // amber-500
    active: '#3b82f6',    // blue-500
    completed: '#22c55e', // green-500
    cancelled: '#ef4444'  // red-500
  },
  // OSM type colors
  osm: {
    school: '#8b5cf6',      // purple
    hospital: '#ef4444',     // red
    library: '#0ea5e9',     // sky blue
    bus_stop: '#f97316',    // orange
    park: '#22c55e',        // green
    pharmacy: '#ec4899',    // pink
    building: '#6b7280',    // gray
    street: '#94a3b8'       // slate
  }
}

// Data source types
const DATA_SOURCES = [
  { id: 'eop', label: 'Public Procurement (EOP)', color: '#3b82f6', icon: Building },
  { id: 'osm', label: 'Points of Interest (OSM)', color: '#8b5cf6', icon: MapPin }
]

// OSM types to show
const OSM_TYPES = [
  { id: 'school', label: 'Schools', color: colors.osm.school },
  { id: 'hospital', label: 'Hospitals', color: colors.osm.hospital },
  { id: 'library', label: 'Libraries', color: colors.osm.library },
  { id: 'bus_stop', label: 'Bus Stops', color: colors.osm.bus_stop },
  { id: 'park', label: 'Parks', color: colors.osm.park },
  { id: 'pharmacy', label: 'Pharmacies', color: colors.osm.pharmacy }
]

function MapPage() {
  const [markers, setMarkers] = useState([])
  const [filteredMarkers, setFilteredMarkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState(['eop', 'osm']) // Show all by default
  const [statusFilter, setStatusFilter] = useState('all')
  const [osmTypeFilter, setOsmTypeFilter] = useState('all')
  const [isFetching, setIsFetching] = useState(false)
  
  // Stara Zagora coordinates
  const defaultCenter = [42.4257, 25.6344]
  const defaultZoom = 13

  // Fetch data from API
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      // Try the unified endpoint first
      try {
        console.log('Fetching from:', `${API_URL}/osm/unified/map?limit=2000`)
        const response = await axios.get(`${API_URL}/osm/unified/map?limit=2000`, {
          timeout: 30000
        })
        
        console.log('API Response:', response.data)
        
        if (response.data?.success) {
          const data = response.data.data || []
          console.log('Markers received:', data.length, 'markers')
          console.log('Sample marker:', data[0])
          setMarkers(data)
          setFilteredMarkers(data)
          setLastUpdated(new Date())
          return
        }
      } catch (apiError) {
        console.warn('Unified endpoint failed, trying fallback:', apiError.message)
        
        // Fallback: try the old projects endpoint
        try {
          const projectsResponse = await axios.get(`${API_URL}/projects?limit=1000`, {
            timeout: 15000
          })
          
          const legacyData = (projectsResponse.data?.data || [])
            .filter(p => p.lat && p.lng)
            .map(p => ({
              ...p,
              source: 'eop',
              color: colors.eop[p.status] || colors.eop.active
            }))
          
          setMarkers(legacyData)
          setFilteredMarkers(legacyData)
          setLastUpdated(new Date())
          return
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError.message)
          throw new Error('Unable to connect to server')
        }
      }
    } catch (err) {
      console.error('Error fetching map data:', err)
      setError('Failed to load map data. Please ensure the server is running.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [API_URL])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing map data...')
      fetchData(true)
    }, AUTO_REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchData])

  // Apply filters
  useEffect(() => {
    let filtered = markers

    // Filter by source
    if (sourceFilter.length > 0 && sourceFilter.length < 2) {
      filtered = filtered.filter(m => m.source === sourceFilter[0])
    }

    // Filter by EOP status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => 
        m.source !== 'eop' || m.status === statusFilter
      )
    }

    // Filter by OSM type
    if (osmTypeFilter !== 'all') {
      filtered = filtered.filter(m => 
        m.source !== 'osm' || m.type === osmTypeFilter
      )
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m => 
        m.title?.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query) ||
        m.type?.toLowerCase().includes(query)
      )
    }

    setFilteredMarkers(filtered)
  }, [markers, sourceFilter, statusFilter, osmTypeFilter, searchQuery])

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

  // Get marker color
  const getMarkerColor = (marker) => {
    if (marker.source === 'eop') {
      return colors.eop[marker.status] || colors.eop.active
    }
    return colors.osm[marker.type] || colors.osm.building
  }

  // Get status badge class
  const getStatusBadge = (status) => {
    const classes = {
      planned: 'status-planned',
      active: 'status-active',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    }
    return classes[status] || 'bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium'
  }

  // Toggle source filter
  const toggleSourceFilter = (source) => {
    setSourceFilter(prev => {
      if (prev.includes(source)) {
        return prev.filter(s => s !== source)
      }
      return [...prev, source]
    })
  }

  // Count markers by type
  const eopCount = markers.filter(m => m.source === 'eop').length
  const osmCount = markers.filter(m => m.source === 'osm').length

  // Manually trigger data fetch
  const triggerDataFetch = async () => {
    try {
      setIsFetching(true)
      console.log('Triggering manual data fetch...')
      
      // First check debug info
      try {
        const debugRes = await axios.get(`${API_URL}/osm/debug`)
        console.log('Debug info:', debugRes.data)
        alert(`Current DB state:\nOSM: ${debugRes.data.counts.osm} records\nEOP: ${debugRes.data.counts.eop} records\n\nStarting data fetch...`)
      } catch (e) {
        console.error('Debug check failed:', e)
      }
      
      const response = await axios.post(`${API_URL}/scraper/run`, { type: 'full' })
      console.log('Fetch triggered:', response.data)
      alert('Data fetch completed! Check console for details. Refreshing map in 5 seconds...')
      setTimeout(() => fetchData(true), 5000)
    } catch (error) {
      console.error('Error triggering fetch:', error)
      alert('Failed to trigger data fetch: ' + (error.response?.data?.message || error.message))
    } finally {
      setIsFetching(false)
    }
  }

  // Check database status
  const checkStatus = async () => {
    try {
      const debugRes = await axios.get(`${API_URL}/osm/debug`)
      console.log('Database status:', debugRes.data)
      alert(`Database Status:\n\nTables: ${debugRes.data.tables.join(', ')}\n\nRecords with coordinates:\nOSM: ${debugRes.data.counts.osm}\nEOP: ${debugRes.data.counts.eop}\n\nTotal: ${debugRes.data.counts.osm + debugRes.data.counts.eop}`)
    } catch (error) {
      console.error('Error checking status:', error)
      alert('Failed to check status: ' + (error.response?.data?.message || error.message))
    }
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
          onClick={() => fetchData()}
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
            Explore municipal projects and points of interest in Stara Zagora
          </p>
        </div>
        
        {/* Last updated & Refresh */}
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString('bg-BG')}
            </span>
          )}
          <button
            onClick={checkStatus}
            className="btn-secondary flex items-center space-x-2 text-sm"
            title="Check database status"
          >
            <Info className="h-4 w-4" />
            <span>Status</span>
          </button>
          <button
            onClick={triggerDataFetch}
            disabled={isFetching}
            className="btn-secondary flex items-center space-x-2"
            title="Fetch fresh data from external sources"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Fetching...' : 'Fetch Data'}</span>
          </button>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Public Tenders</p>
              <p className="text-2xl font-bold text-blue-600">{eopCount}</p>
            </div>
            <Building className="h-8 w-8 text-blue-200" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Points of Interest</p>
              <p className="text-2xl font-bold text-purple-600">{osmCount}</p>
            </div>
            <MapPin className="h-8 w-8 text-purple-200" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Projects</p>
              <p className="text-2xl font-bold text-green-600">
                {markers.filter(m => m.status === 'active').length}
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Markers</p>
              <p className="text-2xl font-bold text-gray-600">{markers.length}</p>
            </div>
            <MapPin className="h-8 w-8 text-gray-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects, schools, hospitals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Data Source Filters */}
          <div className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Sources:</span>
            {DATA_SOURCES.map(source => (
              <button
                key={source.id}
                onClick={() => toggleSourceFilter(source.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  sourceFilter.includes(source.id)
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: sourceFilter.includes(source.id) ? source.color : undefined
                }}
              >
                {source.label}
              </button>
            ))}
          </div>

          {/* EOP Status Filter */}
          {sourceFilter.includes('eop') && (
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field w-36"
              >
                <option value="all">All Status</option>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* OSM Type Filter */}
          {sourceFilter.includes('osm') && (
            <div className="flex items-center space-x-2">
              <select
                value={osmTypeFilter}
                onChange={(e) => setOsmTypeFilter(e.target.value)}
                className="input-field w-36"
              >
                <option value="all">All Types</option>
                {OSM_TYPES.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mt-3">
          Showing {filteredMarkers.length} of {markers.length} markers
          {lastUpdated && ` • Auto-refreshes every ${AUTO_REFRESH_INTERVAL / 60000} minutes`}
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
            
            {filteredMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={[parseFloat(marker.lat), parseFloat(marker.lng)]}
                icon={createCustomIcon(getMarkerColor(marker))}
              >
                <Popup>
                  <div className="p-2 min-w-[250px]">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-gray-900 flex-1">
                        {marker.title}
                      </h3>
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full text-white ml-2"
                        style={{ backgroundColor: getMarkerColor(marker) }}
                      >
                        {marker.source.toUpperCase()}
                      </span>
                    </div>
                    
                    {/* EOP-specific content */}
                    {marker.source === 'eop' && (
                      <>
                        <span className={getStatusBadge(marker.status)}>
                          {marker.status}
                        </span>
                        
                        {marker.description && (
                          <p className="text-sm text-gray-600 mt-3 line-clamp-3">
                            {marker.description}
                          </p>
                        )}
                        
                        <div className="mt-3 space-y-2 text-sm">
                          {marker.budget && (
                            <div className="flex items-center text-gray-700">
                              <DollarSign className="h-4 w-4 mr-2 text-secondary-600" />
                              <span className="font-medium">
                                {formatCurrency(marker.budget)}
                              </span>
                            </div>
                          )}
                          
                          {marker.contractor && (
                            <div className="flex items-center text-gray-700">
                              <Building className="h-4 w-4 mr-2 text-primary-600" />
                              <span>{marker.contractor}</span>
                            </div>
                          )}
                          
                          {marker.address && (
                            <div className="flex items-center text-gray-700">
                              <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                              <span>{marker.address}</span>
                            </div>
                          )}
                        </div>

                        {marker.url && (
                          <a 
                            href={marker.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-3 block text-sm text-blue-600 hover:underline"
                          >
                            View Source →
                          </a>
                        )}
                      </>
                    )}

                    {/* OSM-specific content */}
                    {marker.source === 'osm' && (
                      <div className="mt-2">
                        <span 
                          className="text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: getMarkerColor(marker) }}
                        >
                          {marker.type?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <div className="flex items-center space-x-2 mb-3">
          <Info className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Map Legend</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* EOP Legend */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Public Procurement (EOP)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
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

          {/* OSM Legend */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Points of Interest (OSM)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow mr-2"></div>
                <span>Schools</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow mr-2"></div>
                <span>Hospitals</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow mr-2"></div>
                <span>Libraries</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow mr-2"></div>
                <span>Bus Stops</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow mr-2"></div>
                <span>Parks</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-pink-500 border-2 border-white shadow mr-2"></div>
                <span>Pharmacies</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources Info */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">📡 Data Sources</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• <strong>ЦАИС ЕОП (eop.bg)</strong> — Public procurement contracts (scraped automatically)</p>
          <p>• <strong>OpenStreetMap</strong> — Streets, buildings, bus stops, schools (via Overpass API)</p>
          <p>• <strong>data.egov.bg</strong> — Bulgarian government open data</p>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Data is automatically refreshed every {AUTO_REFRESH_INTERVAL / 60000} minutes. Last update: {lastUpdated?.toLocaleString('bg-BG') || 'Never'}
        </p>
      </div>
    </div>
  )
}

export default MapPage

