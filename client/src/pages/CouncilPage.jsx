/**
 * Council Page
 * 
 * Displays municipal council voting records and statistics.
 * Shows voting history, results, and participation analytics.
 */

import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'
import {
  Users,
  CheckCircle,
  XCircle,
  MinusCircle,
  Calendar,
  Search,
  Filter,
  TrendingUp,
  Gavel,
  FileText
} from 'lucide-react'

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function CouncilPage() {
  const [votes, setVotes] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [resultFilter, setResultFilter] = useState('all')

  // Fetch votes data
  useEffect(() => {
    fetchVotes()
    fetchStatistics()
    fetchYears()
  }, [selectedYear])

  const fetchVotes = async () => {
    try {
      setLoading(true)
      const response = await axios.get(
        `${API_URL}/votes?year=${selectedYear}&limit=100`
      )
      setVotes(response.data.data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching votes:', err)
      setError('Failed to load voting records. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const fetchStatistics = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/votes/statistics?year=${selectedYear}`
      )
      setStatistics(response.data)
    } catch (err) {
      console.error('Error fetching statistics:', err)
    }
  }

  const fetchYears = async () => {
    try {
      const response = await axios.get(`${API_URL}/votes/years`)
      setYears(response.data.years || [new Date().getFullYear()])
    } catch (err) {
      console.error('Error fetching years:', err)
    }
  }

  // Filter votes based on search and result filter
  const filteredVotes = votes.filter((vote) => {
    const matchesSearch = searchQuery === '' || 
      vote.proposal_title?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesResult = resultFilter === 'all' || vote.result === resultFilter
    return matchesSearch && matchesResult
  })

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Get result badge style
  const getResultBadge = (result) => {
    const classes = {
      passed: 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center',
      rejected: 'bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium flex items-center',
      postponed: 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium flex items-center',
      unknown: 'bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium flex items-center'
    }
    return classes[result] || classes.unknown
  }

  // Get result icon
  const getResultIcon = (result) => {
    switch (result) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 mr-1" />
      case 'rejected':
        return <XCircle className="h-4 w-4 mr-1" />
      case 'postponed':
        return <MinusCircle className="h-4 w-4 mr-1" />
      default:
        return <MinusCircle className="h-4 w-4 mr-1" />
    }
  }

  // Calculate participation percentage
  const getParticipationPercentage = (vote) => {
    const total = vote.vote_yes + vote.vote_no + vote.vote_abstain
    // Assuming 41 council members (typical for Bulgarian municipalities)
    const councilSize = 41
    return Math.round((total / councilSize) * 100)
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
          onClick={fetchVotes}
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
          <h1 className="text-3xl font-bold text-gray-900">Council Votes</h1>
          <p className="text-gray-600 mt-1">
            Municipal council voting records and decisions
          </p>
        </div>

        {/* Year Selector */}
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="input-field w-32"
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics?.overall && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Votes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {statistics.overall.total_votes}
                </p>
              </div>
              <div className="p-3 bg-primary-100 rounded-lg">
                <Gavel className="h-8 w-8 text-primary-600" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Passed</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {statistics.overall.passed_count}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {statistics.overall.rejected_count}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Participation</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {Math.round(statistics.overall.avg_participation || 0)}
                </p>
                <p className="text-sm text-gray-500">council members</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {statistics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Breakdown */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Monthly Voting Activity
            </h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statistics.monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={(value) => {
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                      return months[value - 1] || value
                    }}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => {
                      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                                    'July', 'August', 'September', 'October', 'November', 'December']
                      return months[value - 1] || value
                    }}
                  />
                  <Bar dataKey="passed" fill="#22c55e" name="Passed" />
                  <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Participation Trends */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Participation Trends
            </h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statistics.participationTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="session_date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('bg-BG', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis domain={[0, 41]} />
                  <Tooltip 
                    labelFormatter={(value) => formatDate(value)}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total_participation" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Total Participation"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="vote_yes" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    name="Yes Votes"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="vote_no" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="No Votes"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search proposals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Result Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="input-field w-40"
            >
              <option value="all">All Results</option>
              <option value="passed">Passed</option>
              <option value="rejected">Rejected</option>
              <option value="postponed">Postponed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Votes List */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Voting Records
          <span className="text-sm font-normal text-gray-500 ml-2">
            ({filteredVotes.length} of {votes.length})
          </span>
        </h2>

        <div className="space-y-4">
          {filteredVotes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No voting records found matching your criteria
            </p>
          ) : (
            filteredVotes.map((vote) => (
              <div 
                key={vote.id}
                className="p-6 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Proposal Info */}
                  <div className="flex-1">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-primary-100 rounded-lg">
                        <FileText className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {vote.proposal_title}
                        </h3>
                        <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(vote.session_date)}
                          </span>
                          <span className={getResultBadge(vote.result)}>
                            {getResultIcon(vote.result)}
                            {vote.result?.charAt(0).toUpperCase() + vote.result?.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vote Counts */}
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {vote.vote_yes}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Yes
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {vote.vote_no}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        No
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-600">
                        {vote.vote_abstain}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Abstain
                      </p>
                    </div>
                  </div>
                </div>

                {/* Participation Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Council Participation</span>
                    <span>{getParticipationPercentage(vote)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-primary-500"
                      style={{ width: `${getParticipationPercentage(vote)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Raw Text Preview (if available) */}
                {vote.raw_text && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <details className="text-sm">
                      <summary className="cursor-pointer text-primary-600 hover:text-primary-700 font-medium">
                        View original document text
                      </summary>
                      <p className="mt-2 text-gray-600 whitespace-pre-wrap font-mono text-xs bg-gray-100 p-3 rounded">
                        {vote.raw_text.substring(0, 500)}
                        {vote.raw_text.length > 500 && '...'}
                      </p>
                    </details>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default CouncilPage
