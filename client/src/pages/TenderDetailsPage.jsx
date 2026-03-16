/**
 * Tender Details Page
 * Shows complete information about a specific EOP tender
 */

import { useLanguage } from '../contexts/LanguageContext.jsx'
import { formatCurrency } from '../utils/currency.js'
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import {
  ArrowLeft, MapPin, Building, DollarSign, Calendar, 
  ExternalLink, FileText, User, Clock, AlertCircle
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function TenderDetailsPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const [tender, setTender] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTender = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Try to get from EOP data first
        const response = await axios.get(`${API_URL}/eop/${id}`)
        if (response.data?.success) {
          setTender(response.data.data)
        } else {
          throw new Error('Tender not found')
        }
      } catch (err) {
        console.error('Error fetching tender:', err)
        setError('Failed to load tender details')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchTender()
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary-200 border-t-primary-600" />
        <p className="text-gray-500 text-lg">{t('common.loading')}</p>
      </div>
    )
  }

  if (error || !tender) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-700 text-lg font-medium mb-4">
            {error || 'Tender not found'}
          </p>
          <Link to="/map" className="btn-primary">
            Back to Map
          </Link>
        </div>
      </div>
    )
  }

  const statusColors = {
    planned: 'bg-amber-100 text-amber-800 border-amber-200',
    active: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          to="/map" 
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Map
        </Link>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-primary-50 to-blue-50 px-6 py-8 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight">
                {tender.title}
              </h1>
              {tender.status && (
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${
                  statusColors[tender.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {t(`status.${tender.status}`)}
                </span>
              )}
            </div>
            {tender.budget && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm font-medium">Budget</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(tender.budget)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Content Sections */}
        <div className="p-6 space-y-8">
          {/* Key Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Basic Info */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary-600" />
                  Tender Information
                </h2>
                
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  {tender.eop_id && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                      <span className="text-sm font-medium text-gray-600">EOP Reference</span>
                      <span className="text-gray-900 font-mono text-sm">{tender.eop_id}</span>
                    </div>
                  )}

                  {tender.contractor && (
                    <div className="flex justify-between items-start py-2 border-b border-gray-200 last:border-b-0">
                      <span className="text-sm font-medium text-gray-600">Contractor</span>
                      <span className="text-gray-900 text-right max-w-xs">{tender.contractor}</span>
                    </div>
                  )}

                  {tender.address && (
                    <div className="flex justify-between items-start py-2 border-b border-gray-200 last:border-b-0">
                      <span className="text-sm font-medium text-gray-600">Location</span>
                      <span className="text-gray-900 text-right max-w-xs">{tender.address}</span>
                    </div>
                  )}

                  {tender.budget && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                      <span className="text-sm font-medium text-gray-600">Budget</span>
                      <span className="text-gray-900 font-semibold">{formatCurrency(tender.budget)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {tender.description && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Description</h2>
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {tender.description}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Timeline */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-primary-600" />
                  Timeline
                </h2>
                
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {tender.publication_date && (
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Published</p>
                          <p className="text-xs text-gray-500">
                            {new Date(tender.publication_date).toLocaleDateString('bg-BG', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {tender.end_date && (
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Deadline</p>
                          <p className="text-xs text-gray-500">
                            {new Date(tender.end_date).toLocaleDateString('bg-BG', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {tender.updated_at && (
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Last Updated</p>
                          <p className="text-xs text-gray-500">
                            {new Date(tender.updated_at).toLocaleDateString('bg-BG', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              {(tender.lat && tender.lng) && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary-600" />
                    Location
                  </h2>
                  <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Coordinates</p>
                        <p className="text-sm text-gray-900 font-mono">
                          {parseFloat(tender.lat).toFixed(6)}<br/>
                          {parseFloat(tender.lng).toFixed(6)}
                        </p>
                      </div>
                      <Link 
                        to={`/map?lat=${tender.lat}&lng=${tender.lng}&zoom=16`}
                        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-800 text-sm font-medium w-full justify-center py-2 px-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <MapPin className="h-4 w-4" />
                        View on Map
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* External Links */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            {tender.source_url && (
              <a 
                href={tender.source_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View Original Source
              </a>
            )}
            
            <Link 
              to="/map"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <MapPin className="h-4 w-4" />
              Back to Map
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TenderDetailsPage