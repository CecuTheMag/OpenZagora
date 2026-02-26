/**
 * Home Page / Dashboard
 * 
 * Main dashboard showing overview statistics, recent projects,
 * and quick access to all sections of the application.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { 
  MapPin, 
  DollarSign, 
  Users, 
  TrendingUp, 
  ArrowRight,
  Building,
  Calendar,
  CheckCircle
} from 'lucide-react'

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function Home() {
  const [stats, setStats] = useState({
    projects: { total: 0, active: 0, completed: 0 },
    budget: { total: 0 },
    votes: { total: 0, passed: 0 }
  })
  const [recentProjects, setRecentProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch dashboard data on component mount
  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch projects
      const projectsRes = await axios.get(`${API_URL}/projects?limit=5`)
      const allProjectsRes = await axios.get(`${API_URL}/projects?limit=1000`)
      
      // Fetch budget summary
      const budgetRes = await axios.get(`${API_URL}/budget/summary`)
      
      // Fetch votes statistics
      const votesRes = await axios.get(`${API_URL}/votes/statistics`)

      // Calculate project statistics
      const allProjects = allProjectsRes.data.data || []
      const activeProjects = allProjects.filter(p => p.status === 'active').length
      const completedProjects = allProjects.filter(p => p.status === 'completed').length

      setStats({
        projects: {
          total: allProjects.length,
          active: activeProjects,
          completed: completedProjects
        },
        budget: {
          total: budgetRes.data.grandTotal || 0
        },
        votes: {
          total: votesRes.data.overall?.total_votes || 0,
          passed: votesRes.data.overall?.passed_count || 0
        }
      })

      setRecentProjects(projectsRes.data.data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // Format currency
  const formatCurrency = (amount) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="mt-4 btn-primary"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Open Zagora
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Municipal transparency dashboard for Stara Zagora, Bulgaria. 
          Track public projects, budget allocations, and council decisions.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Projects Stats */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.projects.total}
              </p>
              <div className="flex items-center mt-2 space-x-4 text-sm">
                <span className="text-blue-600">
                  {stats.projects.active} active
                </span>
                <span className="text-green-600">
                  {stats.projects.completed} completed
                </span>
              </div>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Building className="h-8 w-8 text-primary-600" />
            </div>
          </div>
        </div>

        {/* Budget Stats */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Budget</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats.budget.total)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Current fiscal year
              </p>
            </div>
            <div className="p-3 bg-secondary-100 rounded-lg">
              <DollarSign className="h-8 w-8 text-secondary-600" />
            </div>
          </div>
        </div>

        {/* Votes Stats */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Council Votes</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.votes.total}
              </p>
              <p className="text-sm text-green-600 mt-2">
                {stats.votes.passed} proposals passed
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Quick Action */}
        <Link 
          to="/map" 
          className="card hover:shadow-md transition-shadow bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200"
        >
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-sm font-medium text-primary-700">Explore</p>
              <p className="text-xl font-bold text-primary-900 mt-2">
                View Project Map
              </p>
              <div className="flex items-center mt-2 text-primary-700">
                <span className="text-sm">See all locations</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </div>
            </div>
            <div className="p-3 bg-primary-200 rounded-lg">
              <MapPin className="h-8 w-8 text-primary-700" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Projects Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Projects</h2>
          <Link 
            to="/map" 
            className="flex items-center text-primary-600 hover:text-primary-700 font-medium"
          >
            View all
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </div>

        {recentProjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No projects found</p>
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <div 
                key={project.id} 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-semibold text-gray-900">
                      {project.title}
                    </h3>
                    <span className={getStatusBadge(project.status)}>
                      {project.status}
                    </span>
                  </div>
                  <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(project.start_date)}
                    </span>
                    {project.budget && (
                      <span className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {formatCurrency(project.budget)}
                      </span>
                    )}
                    {project.contractor && (
                      <span className="flex items-center">
                        <Building className="h-4 w-4 mr-1" />
                        {project.contractor}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-4">
                  {project.status === 'completed' ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <TrendingUp className="h-6 w-6 text-blue-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center">
          <MapPin className="h-12 w-12 text-primary-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Interactive Map
          </h3>
          <p className="text-gray-600">
            Explore municipal projects on an interactive map with location details and status information.
          </p>
        </div>

        <div className="card text-center">
          <DollarSign className="h-12 w-12 text-secondary-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Budget Transparency
          </h3>
          <p className="text-gray-600">
            Visualize budget allocations by category and track spending across different sectors.
          </p>
        </div>

        <div className="card text-center">
          <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Council Votes
          </h3>
          <p className="text-gray-600">
            Stay informed about municipal council decisions and voting records on important proposals.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Home
