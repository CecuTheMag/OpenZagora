/**
 * Map Page — fullscreen on mobile with bottom sheet controls
 */

import { useLanguage } from '../contexts/LanguageContext.jsx'
import { formatCurrency } from '../utils/currency.js'
import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import axios from 'axios'
import {
  MapPin, Search, Building, DollarSign, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink, Info, LocateFixed, X, SlidersHorizontal, Filter, Layers
} from 'lucide-react'
import L from 'leaflet'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const colors = {
  eop: { planned: '#f59e0b', active: '#3b82f6', completed: '#22c55e', cancelled: '#ef4444' },
  osm: {
    school: '#8b5cf6', hospital: '#ef4444', library: '#0ea5e9',
    bus_stop: '#f97316', park: '#22c55e', pharmacy: '#ec4899',
    building: '#6b7280', street: '#94a3b8'
  },
  gis: {
    municipal: '#10b981', infrastructure: '#f59e0b', zoning: '#8b5cf6'
  }
}

const TILE_LAYERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
  }
}

const OSM_TYPE_IDS = [
  { id: 'school',   color: colors.osm.school },
  { id: 'hospital', color: colors.osm.hospital },
  { id: 'library',  color: colors.osm.library },
  { id: 'bus_stop', color: colors.osm.bus_stop },
  { id: 'park',     color: colors.osm.park },
  { id: 'pharmacy', color: colors.osm.pharmacy },
]

const GIS_TYPE_IDS = [
  { id: 'municipal', color: colors.gis.municipal },
  { id: 'infrastructure', color: colors.gis.infrastructure },
  { id: 'zoning', color: colors.gis.zoning },
]

const STATUS_COLORS = {
  planned:   'bg-amber-100 text-amber-800',
  active:    'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const createCustomIcon = (color, size = 28) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })

// ── GIS Iframe Component ──
function GISFrame() {
  return (
    <div className="w-full h-full relative">
      <iframe
        src="https://gis.starazagora.bg/"
        className="w-full h-full border-0"
        title="Stara Zagora GIS"
        allow="geolocation"
      />
      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-gray-600">
        Stara Zagora GIS
      </div>
    </div>
  )
}

// ── Map Component with conditional rendering ──
function MapComponent({ sourceFilter, mapLayer, filteredMarkers, getMarkerColor, t, defaultCenter, defaultZoom }) {
  if (sourceFilter === 'gis') {
    return <GISFrame />
  }

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution={TILE_LAYERS[mapLayer].attribution}
        url={TILE_LAYERS[mapLayer].url}
      />
      <MarkerLayer markers={filteredMarkers} getMarkerColor={getMarkerColor} t={t} />
    </MapContainer>
  )
}

// ── Shared marker list (used in both normal map and fullscreen map) ──
function MarkerLayer({ markers, getMarkerColor, t }) {
  // Group markers by coordinates
  const groupedMarkers = markers.reduce((groups, marker) => {
    const key = `${parseFloat(marker.lat).toFixed(6)},${parseFloat(marker.lng).toFixed(6)}`
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(marker)
    return groups
  }, {})

  return Object.entries(groupedMarkers).map(([coordKey, markersAtLocation]) => {
    const [lat, lng] = coordKey.split(',').map(Number)
    const primaryMarker = markersAtLocation[0]
    const hasMultiple = markersAtLocation.length > 1

    return (
      <Marker
        key={coordKey}
        position={[lat, lng]}
        icon={createCustomIcon(
          getMarkerColor(primaryMarker), 
          hasMultiple ? 32 : 28
        )}
      >
        <Popup maxWidth={320} minWidth={280}>
          {hasMultiple ? (
            // Multiple markers at same location - scrollable list
            <div className="p-2">
              <div className="text-xs text-gray-500 mb-3 text-center">
                {t('map.itemsAtLocation', { count: markersAtLocation.length })}
              </div>
              <div className="max-h-80 overflow-y-auto space-y-3">
                {markersAtLocation.map((marker, idx) => (
                  <div key={`${marker.source}-${marker.id ?? idx}`} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                    <div className="flex items-start gap-2 mb-2">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0 mt-1" 
                        style={{ backgroundColor: getMarkerColor(marker) }}
                      />
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: getMarkerColor(marker) }}>
                        {marker.source === 'eop' ? t('map.source.eop') : t('map.source.osm')}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">{marker.title}</h3>
                    
                    {marker.source === 'eop' && (
                      <div className="space-y-1.5 text-sm">
                        {marker.status && (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[marker.status] || 'bg-gray-100 text-gray-700'}`}>
                            {t(`status.${marker.status}`)}
                          </span>
                        )}
                        {marker.budget && (
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <DollarSign className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            <span className="font-medium text-xs">{formatCurrency(marker.budget)}</span>
                          </div>
                        )}
                        {marker.contractor && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Building className="h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-1 text-xs">{marker.contractor}</span>
                          </div>
                        )}
                        {marker.address && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs line-clamp-1">{marker.address}</span>
                          </div>
                        )}
                        {marker.description && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600 line-clamp-2">{marker.description}</p>
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <a 
                            href={`/tender/${marker.id}`}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 bg-blue-50 rounded transition-colors"
                          >
                            <Info className="h-3 w-3" />
                            {t('map.viewDetails')}
                          </a>
                          {marker.url && (
                            <a href={marker.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-xs px-2 py-1 bg-gray-50 rounded transition-colors">
                              <ExternalLink className="h-3 w-3" />
                              {t('map.viewSource')}
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {marker.source === 'osm' && (
                      <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                        <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: getMarkerColor(marker) }} />
                        <span className="text-xs">{t(`map.osm.${marker.type}`) || marker.type}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Single marker - original layout
            <div className="p-1">
              <span
                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full text-white mb-2"
                style={{ backgroundColor: getMarkerColor(primaryMarker) }}
              >
                {primaryMarker.source === 'eop' ? t('map.source.eop') : t('map.source.osm')}
              </span>
              <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">{primaryMarker.title}</h3>
              {primaryMarker.source === 'eop' && (
                <div className="space-y-1.5 text-sm">
                  {primaryMarker.status && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[primaryMarker.status] || 'bg-gray-100 text-gray-700'}`}>
                      {t(`status.${primaryMarker.status}`)}
                    </span>
                  )}
                  {primaryMarker.budget && (
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <DollarSign className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span className="font-medium">{formatCurrency(primaryMarker.budget)}</span>
                    </div>
                  )}
                  {primaryMarker.contractor && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Building className="h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-1 text-xs">{primaryMarker.contractor}</span>
                    </div>
                  )}
                  {primaryMarker.address && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs line-clamp-1">{primaryMarker.address}</span>
                    </div>
                  )}
                  {primaryMarker.description && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 line-clamp-2">{primaryMarker.description}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <a 
                      href={`/tender/${primaryMarker.id}`}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 bg-blue-50 rounded transition-colors"
                    >
                      <Info className="h-3 w-3" />
                      {t('map.viewDetails')}
                    </a>
                    {primaryMarker.url && (
                      <a href={primaryMarker.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-xs px-2 py-1 bg-gray-50 rounded transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        {t('map.viewSource')}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {primaryMarker.source === 'osm' && (
                <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: getMarkerColor(primaryMarker) }} />
                  <span>{t(`map.osm.${primaryMarker.type}`) || primaryMarker.type}</span>
                </div>
              )}
            </div>
          )}
        </Popup>
      </Marker>
    )
  })
}

// ── Filter + Legend panel ──
function FiltersPanel({ t, searchQuery, setSearchQuery, sourceFilter, setSourceFilter,
  statusFilter, setStatusFilter, osmTypeFilter, setOsmTypeFilter, gisTypeFilter, setGisTypeFilter,
  filteredMarkers, markers, lastUpdated, mapLayer, setMapLayer }) {

  // Legend items based on active filters
  const legendItems = []
  if (sourceFilter === 'eop') {
    const statuses = statusFilter === 'all'
      ? ['completed', 'active', 'planned', 'cancelled']
      : [statusFilter]
    statuses.forEach(s => legendItems.push({ color: colors.eop[s], label: t(`status.${s}`) }))
  } else if (sourceFilter === 'osm') {
    const types = osmTypeFilter === 'all' ? OSM_TYPE_IDS : OSM_TYPE_IDS.filter(tp => tp.id === osmTypeFilter)
    types.forEach(tp => legendItems.push({ color: tp.color, label: t(`map.osm.${tp.id}`) }))
  }
  // No legend for GIS since it's an iframe

  return (
    <div className="flex flex-col gap-3">
      {/* Map Layer Selection - only show for non-GIS sources */}
      {sourceFilter !== 'gis' && (
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
            {t('map.baseLayer')}
          </label>
          <div className="flex gap-1">
            {Object.entries(TILE_LAYERS).map(([key, layer]) => (
              <button
                key={key}
                onClick={() => setMapLayer(key)}
                className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all border ${
                  mapLayer === key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {key === 'osm' ? t('map.tileOsm') : t('map.tileSatellite')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search - only show for non-GIS sources */}
      {sourceFilter !== 'gis' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('map.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50"
          />
        </div>
      )}

      {/* Source toggle — EOP, OSM, or GIS */}
      <div className="flex gap-1">
        {[
          { id: 'eop', label: 'EOP', color: '#3b82f6' },
          { id: 'osm', label: 'OSM', color: '#8b5cf6' },
          { id: 'gis', label: 'GIS', color: '#10b981' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSourceFilter(s.id)}
            className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all border ${
              sourceFilter === s.id ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
            style={sourceFilter === s.id ? { backgroundColor: s.color } : {}}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* GIS Info */}
      {sourceFilter === 'gis' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <ExternalLink className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">{t('map.source.gis')}</p>
              <p className="text-xs text-green-700 mt-1">{t('map.gisDesc')}</p>
              <a 
                href="https://gis.starazagora.bg/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:text-green-800 underline mt-1 inline-block"
              >
                {t('map.openInNewTab')}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Status filter — only for EOP */}
      {sourceFilter === 'eop' && (
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="w-full py-2.5 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">{t('map.allStatus')}</option>
          <option value="planned">{t('status.planned')}</option>
          <option value="active">{t('status.active')}</option>
          <option value="completed">{t('status.completed')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
        </select>
      )}

      {/* OSM type filter — only for OSM */}
      {sourceFilter === 'osm' && (
        <select value={osmTypeFilter} onChange={e => setOsmTypeFilter(e.target.value)}
          className="w-full py-2.5 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">{t('map.allTypes')}</option>
          {OSM_TYPE_IDS.map(tp => (
            <option key={tp.id} value={tp.id}>{t(`map.osm.${tp.id}`)}</option>
          ))}
        </select>
      )}

      {/* GIS type filter — only for GIS */}
      {sourceFilter === 'gis' && (
        <select value={gisTypeFilter} onChange={e => setGisTypeFilter(e.target.value)}
          className="w-full py-2.5 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">{t('map.allTypes')}</option>
          {GIS_TYPE_IDS.map(tp => (
            <option key={tp.id} value={tp.id}>{t(`map.gis.${tp.id}`)}</option>
          ))}
        </select>
      )}

      {/* Count - only show for non-GIS sources */}
      {sourceFilter !== 'gis' && (
        <p className="text-xs text-gray-400">
          {t('map.showing', { filtered: filteredMarkers.length, total: markers.length })}
          {lastUpdated && ` · ${lastUpdated.toLocaleTimeString('bg-BG')}`}
        </p>
      )}

      {/* Legend — only relevant items, not for GIS */}
      {legendItems.length > 0 && sourceFilter !== 'gis' && (
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Info className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('map.legend')}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {legendItems.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-600 truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Floating filter button + dropdown ──
function FilterDropdown({ t, filterProps, activeFilterCount }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm text-sm font-medium transition-all ${
          open ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
        }`}
      >
        <Filter className="h-4 w-4" />
        {t('map.filtersAndLegend')}
        {activeFilterCount > 0 && (
          <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold ${
            open ? 'bg-white text-primary-600' : 'bg-primary-600 text-white'
          }`}>
            {activeFilterCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl z-[2000] p-4">
          <FiltersPanel {...filterProps} />
        </div>
      )}
    </div>
  )
}

function MapPage() {
  const { t } = useLanguage()

  const [markers, setMarkers] = useState([])
  const [filteredMarkers, setFilteredMarkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('eop')
  const [statusFilter, setStatusFilter] = useState('all')
  const [osmTypeFilter, setOsmTypeFilter] = useState('all')
  const [gisTypeFilter, setGisTypeFilter] = useState('all')
  const [mapLayer, setMapLayer] = useState('osm')
  const [gisStatus, setGisStatus] = useState('checking') // 'active', 'inactive', 'checking'

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)

  const defaultCenter = [42.4257, 25.6344]
  const defaultZoom = 13

  // Check GIS site availability
  const checkGISStatus = useCallback(async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      const response = await fetch('https://gis.starazagora.bg/', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      setGisStatus('active')
    } catch (error) {
      setGisStatus('inactive')
    }
  }, [])

  useEffect(() => {
    checkGISStatus()
    // Check GIS status every 5 minutes
    const gisInterval = setInterval(checkGISStatus, 5 * 60 * 1000)
    return () => clearInterval(gisInterval)
  }, [checkGISStatus])

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setSheetOpen(false)
    }
    return () => { document.body.style.overflow = '' }
  }, [isFullscreen])

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      setError(null)
      const allMarkers = []

      try {
        const r = await axios.get(`${API_URL}/eop/map?limit=1000`, { timeout: 10000 })
        if (r.data?.success) allMarkers.push(...r.data.data)
      } catch {}

      try {
        const r = await axios.get(`${API_URL}/osm/unified/map?limit=1000`, { timeout: 10000 })
        if (r.data?.success) allMarkers.push(...r.data.data)
      } catch {}

      try {
        const r = await axios.get(`${API_URL}/projects?limit=500`, { timeout: 10000 })
        const legacy = (r.data?.data || [])
          .filter(p => p.lat && p.lng)
          .map(p => ({ ...p, source: 'projects', color: colors.eop[p.status] || '#6b7280' }))
        allMarkers.push(...legacy)
      } catch {}

      const seen = new Set()
      const deduped = allMarkers.filter(m => {
        const k = `${m.source}-${m.id}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      if (deduped.length === 0) throw new Error('no_data')
      setMarkers(deduped)
      setFilteredMarkers(deduped)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message === 'no_data' ? t('map.noDataError') : t('map.loadError'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const id = setInterval(() => fetchData(true), AUTO_REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetchData])

  useEffect(() => {
    let f = markers
    if (sourceFilter === 'eop') f = f.filter(m => m.source === 'eop')
    else if (sourceFilter === 'osm') f = f.filter(m => m.source === 'osm')
    else if (sourceFilter === 'gis') f = f.filter(m => m.source === 'gis')
    if (statusFilter !== 'all') f = f.filter(m => m.source !== 'eop' || m.status === statusFilter)
    if (osmTypeFilter !== 'all') f = f.filter(m => m.source !== 'osm' || m.type === osmTypeFilter)
    if (gisTypeFilter !== 'all') f = f.filter(m => m.source !== 'gis' || m.type === gisTypeFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      f = f.filter(m =>
        m.title?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.type?.toLowerCase().includes(q)
      )
    }
    setFilteredMarkers(f)
  }, [markers, sourceFilter, statusFilter, osmTypeFilter, gisTypeFilter, searchQuery])

  const getMarkerColor = m => {
    if (m.source === 'eop') return colors.eop[m.status] || colors.eop.active
    if (m.source === 'osm') return colors.osm[m.type] || colors.osm.building
    if (m.source === 'gis') return colors.gis[m.type] || colors.gis.municipal
    return '#6b7280'
  }

  const triggerDataFetch = async () => {
    try {
      setIsFetching(true)
      const [eopRes, osmRes] = await Promise.allSettled([
        axios.post(`${API_URL}/eop/fetch-and-import`),
        axios.post(`${API_URL}/osm/fetch`),
      ])
      const eop = eopRes.status === 'fulfilled' ? eopRes.value.data : null
      const osm = osmRes.status === 'fulfilled' ? osmRes.value.data : null
      const lines = []
      if (eop?.success) lines.push(t('map.fetchSuccess', { imported: eop.data.import.imported, updated: eop.data.import.updated }))
      else lines.push(t('map.fetchEopFail'))
      alert(lines.join('\n'))
      setTimeout(() => fetchData(true), 2000)
    } catch (e) {
      alert(t('map.errorPrefix') + (e.response?.data?.message || e.message))
    } finally {
      setIsFetching(false)
    }
  }

  const triggerGeocode = async () => {
    try {
      setIsGeocoding(true)
      await axios.post(`${API_URL}/eop/geocode`, { method: 'hybrid' })
      await axios.post(`${API_URL}/eop/geocode`, { method: 'poi' })
      alert(t('map.geocodeStarted'))
      setTimeout(() => fetchData(true), 3000)
    } catch (e) {
      alert(t('map.errorPrefix') + (e.response?.data?.message || e.message))
    } finally {
      setIsGeocoding(false)
    }
  }

  const getGisStatusValue = () => {
    if (gisStatus === 'checking') return t('map.gisChecking')
    return gisStatus === 'active' ? t('map.gisActive') : t('map.gisInactive')
  }

  const getGisStatusColor = () => {
    if (gisStatus === 'checking') return 'text-gray-600'
    return gisStatus === 'active' ? 'text-green-600' : 'text-red-600'
  }

  const getGisStatusBg = () => {
    if (gisStatus === 'checking') return 'bg-gray-50'
    return gisStatus === 'active' ? 'bg-green-50' : 'bg-red-50'
  }

  const getGisStatusDot = () => {
    if (gisStatus === 'checking') return 'bg-gray-400'
    return gisStatus === 'active' ? 'bg-green-500' : 'bg-red-500'
  }

  const eopCount = markers.filter(m => m.source === 'eop').length
  const osmCount = markers.filter(m => m.source === 'osm').length
  const gisCount = markers.filter(m => m.source === 'gis').length
  const activeCount = markers.filter(m => m.status === 'active').length

  const filterProps = {
    t, searchQuery, setSearchQuery, sourceFilter, setSourceFilter,
    statusFilter, setStatusFilter, osmTypeFilter, setOsmTypeFilter,
    gisTypeFilter, setGisTypeFilter, filteredMarkers, markers, lastUpdated,
    mapLayer, setMapLayer
  }

  const activeFilterCount = [
    searchQuery.trim() !== '',
    statusFilter !== 'all',
    osmTypeFilter !== 'all',
    gisTypeFilter !== 'all',
  ].filter(Boolean).length

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary-200 border-t-primary-600" />
        <p className="text-gray-500 text-lg">{t('common.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-md w-full">
          <MapPin className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-700 text-lg font-medium mb-4">{error}</p>
          <button onClick={() => fetchData()} className="btn-primary w-full py-3 text-base">
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ════════════════════════════════════════
          FULLSCREEN OVERLAY (mobile tap-to-expand)
          ════════════════════════════════════════ */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">

          {/* Map — fills everything above the sheet */}
          <div className="flex-1 relative">
            <MapComponent 
              sourceFilter={sourceFilter}
              mapLayer={mapLayer}
              filteredMarkers={filteredMarkers}
              getMarkerColor={getMarkerColor}
              t={t}
              defaultCenter={defaultCenter}
              defaultZoom={defaultZoom}
            />

            {/* Close button */}
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-[1000] bg-white rounded-full p-2.5 shadow-lg border border-gray-200 active:scale-95 transition-transform"
              aria-label="Close fullscreen"
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>

            {/* Filters toggle button — bottom center, above sheet */}
            <button
              onClick={() => setSheetOpen(v => !v)}
              className={`absolute left-1/2 -translate-x-1/2 bottom-4 z-[1000] flex items-center gap-2 bg-white rounded-full px-5 py-3 shadow-lg border border-gray-200 font-medium text-gray-700 active:scale-95 transition-all duration-300`}
            >
              <Filter className="h-4 w-4" />
              {sourceFilter === 'gis' ? t('map.source.gis') : t('map.filtersAndLegend')}
              {activeFilterCount > 0 && sourceFilter !== 'gis' && (
                <span className="bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Bottom sheet */}
          <div
            className={`bg-white transition-all duration-300 ease-in-out overflow-hidden ${
              sheetOpen ? 'max-h-[60vh]' : 'max-h-0'
            }`}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: 'calc(60vh - 24px)' }}>
              <FiltersPanel {...filterProps} />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          NORMAL PAGE LAYOUT
          ════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 pb-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('map.title')}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{t('map.description')}</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="self-start sm:self-auto flex items-center gap-2 btn-secondary text-sm px-4 py-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('common.loading') : t('common.refresh')}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('map.publicTenders'),    value: eopCount,    color: 'text-blue-600',   bg: 'bg-blue-50',   dot: 'bg-blue-500' },
            { label: t('map.pointsOfInterest'), value: osmCount,    color: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-500' },
            { label: t('map.gisStatus'), value: getGisStatusValue(), color: getGisStatusColor(), bg: getGisStatusBg(), dot: getGisStatusDot() },
            { label: t('map.totalMarkers'),     value: markers.length, color: 'text-gray-700', bg: 'bg-gray-50', dot: 'bg-gray-400' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 flex flex-col gap-1`}>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                <span className="text-xs text-gray-500 leading-tight">{s.label}</span>
              </div>
              <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Mobile hint strip */}
        <div className="sm:hidden bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-blue-700">
          <MapPin className="h-4 w-4 shrink-0" />
          {t('map.tapToFullscreen')}
        </div>

        {/* Map */}
        <div
          className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative"
          style={{ height: 'clamp(280px, 50vw, 620px)' }}
        >
          <MapComponent 
            sourceFilter={sourceFilter}
            mapLayer={mapLayer}
            filteredMarkers={filteredMarkers}
            getMarkerColor={getMarkerColor}
            t={t}
            defaultCenter={defaultCenter}
            defaultZoom={defaultZoom}
          />

          {/* Filter button — top right of map, desktop */}
          <div className={`hidden sm:block absolute z-[1000] transition-all duration-300 ${
            sourceFilter === 'gis' 
              ? 'top-3 left-1/2 -translate-x-1/2' 
              : 'top-3 right-3 translate-x-0'
          }`}>
            <FilterDropdown t={t} filterProps={filterProps} activeFilterCount={activeFilterCount} />
          </div>

          {/* Mobile tap-to-fullscreen overlay — invisible but captures the tap */}
          <div
            className="sm:hidden absolute inset-0 z-[500] cursor-pointer"
            onClick={() => setIsFullscreen(true)}
            aria-label={t('map.tapToFullscreen')}
          />
        </div>

      </div>
    </>
  )
}

export default MapPage
