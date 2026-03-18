/**
 * Home Page / Dashboard
 * 
 * Main dashboard showing overview statistics, recent projects,
 * and quick access to all sections of the application.
 */

import { useLanguage } from '../contexts/LanguageContext.jsx'
import { formatCurrency } from '../utils/currency.js'
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
  CheckCircle,
  FileText
} from 'lucide-react'

// API base URL - use relative path to work with Vite proxy
const API_URL = import.meta.env.VITE_API_URL || '/api'

function Home() {
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    municipality: {
      population: 138000, // Stara Zagora population
      area: 1036, // km²
      districts: 23
    },
    tenders: { total: 0, active: 0, completed: 0, totalValue: 0 },
    projects: { total: 0, active: 0, completed: 0 },
    budget: { total: 0, spent: 0, remaining: 0 },
    votes: { total: 0, passed: 0, recent: 0 }
  })
  const [recentTenders, setRecentTenders] = useState([])
  const [recentProjects, setRecentProjects] = useState([])
  const [recentVotes, setRecentVotes] = useState([])
  const [news, setNews] = useState([])
  const [events, setEvents] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch dashboard data on component mount
  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch EOP tenders data
      const eopRes = await axios.get(`${API_URL}/eop/map?limit=1000`)
      const eopData = eopRes.data?.data || []
      
      // Fetch recent EOP tenders for display
      const recentEopRes = await axios.get(`${API_URL}/eop/map?limit=5`)
      const recentEopData = recentEopRes.data?.data || []
      
      // Fetch legacy projects
      const projectsRes = await axios.get(`${API_URL}/projects?limit=5`)
      const allProjectsRes = await axios.get(`${API_URL}/projects?limit=1000`)
      const allProjects = allProjectsRes.data.data || []
      
      // Fetch budget summary
      const budgetRes = await axios.get(`${API_URL}/budget/summary`)
      
      // Fetch votes statistics and recent votes
      const votesRes = await axios.get(`${API_URL}/votes/statistics`)
      const recentVotesRes = await axios.get(`${API_URL}/votes?limit=3`)

      // Calculate EOP tender statistics
      const activeTenders = eopData.filter(t => t.status === 'active').length
      const completedTenders = eopData.filter(t => t.status === 'completed').length
      const totalTenderValue = eopData.reduce((sum, t) => sum + (parseFloat(t.budget) || 0), 0)

      // Calculate project statistics
      const activeProjects = allProjects.filter(p => p.status === 'active').length
      const completedProjects = allProjects.filter(p => p.status === 'completed').length

      // Get budget data
      const totalBudget = budgetRes.data?.grandTotal || 0
      const budgetSpent = totalBudget * 0.65 // Estimate 65% spent (would be real data)

      setStats({
        municipality: {
          population: 138000,
          area: 1036,
          districts: 23
        },
        tenders: {
          total: eopData.length,
          active: activeTenders,
          completed: completedTenders,
          totalValue: totalTenderValue
        },
        projects: {
          total: allProjects.length,
          active: activeProjects,
          completed: completedProjects
        },
        budget: {
          total: totalBudget,
          spent: budgetSpent,
          remaining: totalBudget - budgetSpent
        },
        votes: {
          total: votesRes.data?.overall?.total_votes || 0,
          passed: votesRes.data?.overall?.passed_count || 0,
          recent: votesRes.data?.overall?.total_votes || 0
        }
      })

      setRecentTenders(recentEopData)
      setRecentProjects(projectsRes.data?.data || [])
      setRecentVotes(recentVotesRes.data?.data || [])

      // Fetch official municipality news & events
      try {
        const newsRes = await axios.get(`${API_URL}/news`)
        setNews(newsRes.data?.news || [])
        setEvents(newsRes.data?.events || [])
      } catch (_) {}
      
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data. Please try again later.')
    } finally {
      setLoading(false)
    }
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
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl text-white p-5 sm:p-8 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4">
              {t('home.municipality')}
            </h1>
            <p className="text-base sm:text-xl text-primary-100 mb-4 sm:mb-6">
              {t('home.subtitle')}
            </p>
            <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>{stats.municipality.population.toLocaleString('bg-BG')} {t('home.residents')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>{stats.municipality.area} {t('home.area')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>{stats.municipality.districts} {t('home.districts')}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold truncate">{stats.tenders.active}</div>
              <div className="text-xs sm:text-sm text-primary-100 mt-0.5">{t('home.activeTenders')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center">
              <div className="text-sm sm:text-xl font-bold truncate">{formatCurrency(stats.budget.total)}</div>
              <div className="text-xs sm:text-sm text-primary-100 mt-0.5">{t('home.totalBudget2024')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold truncate">{stats.projects.active}</div>
              <div className="text-xs sm:text-sm text-primary-100 mt-0.5">{t('home.currentProjects')}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-bold truncate">{stats.votes.total}</div>
              <div className="text-xs sm:text-sm text-primary-100 mt-0.5">{t('home.councilDecisions')}</div>
            </div>
          </div>
        </div>
        {lastUpdated && (
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-primary-500/30 text-xs sm:text-sm text-primary-100">
            {t('home.lastUpdated')}: {lastUpdated.toLocaleString('bg-BG')}
          </div>
        )}
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
        {/* Public Tenders */}
        <Link to="/map" className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary-500 !p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{t('home.publicTenders')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{stats.tenders.total}</p>
              <div className="flex flex-col sm:flex-row sm:items-center mt-1 sm:mt-2 gap-0.5 sm:gap-3 text-xs sm:text-sm">
                <span className="text-primary-600 font-medium whitespace-nowrap">{stats.tenders.active} {t('home.activeTendersLabel')}</span>
                <span className="text-green-600 whitespace-nowrap">{stats.tenders.completed} {t('home.completedLabel')}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">{t('home.totalValue')}: {formatCurrency(stats.tenders.totalValue)}</div>
            </div>
            <div className="p-2 sm:p-3 bg-primary-100 rounded-lg shrink-0">
              <FileText className="h-5 w-5 sm:h-8 sm:w-8 text-primary-600" />
            </div>
          </div>
        </Link>

        {/* Budget Execution */}
        <Link to="/budget" className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500 !p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{t('home.budgetExecution')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{Math.round((stats.budget.spent / stats.budget.total) * 100)}%</p>
              <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 mt-1 sm:mt-2">
                <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${(stats.budget.spent / stats.budget.total) * 100}%` }}></div>
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">{t('home.spent')}: {formatCurrency(stats.budget.spent)}</div>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg shrink-0">
              <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-green-600" />
            </div>
          </div>
        </Link>

        {/* Council Decisions */}
        <Link to="/council" className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-purple-500 !p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{t('home.councilDecisionsLabel')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{stats.votes.total}</p>
              <div className="flex flex-col sm:flex-row sm:items-center mt-1 sm:mt-2 gap-0.5 sm:gap-3 text-xs sm:text-sm">
                <span className="text-green-600 font-medium whitespace-nowrap">{stats.votes.passed} {t('home.passed')}</span>
                <span className="text-gray-500 whitespace-nowrap">{stats.votes.total - stats.votes.passed} {t('home.rejected')}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{t('home.passRate')}: {Math.round((stats.votes.passed / (stats.votes.total || 1)) * 100)}%</div>
            </div>
            <div className="p-2 sm:p-3 bg-purple-100 rounded-lg shrink-0">
              <Users className="h-5 w-5 sm:h-8 sm:w-8 text-purple-600" />
            </div>
          </div>
        </Link>

        {/* Quick Access */}
        <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-all duration-200 !p-4">
          <div className="text-center">
            <div className="p-2 sm:p-3 bg-orange-200 rounded-lg w-fit mx-auto mb-2 sm:mb-3">
              <Calendar className="h-5 w-5 sm:h-8 sm:w-8 text-orange-600" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-orange-800 mb-1 sm:mb-2">{t('home.recentCouncilVotes')}</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.votes.total}</p>
            <p className="text-xs text-orange-700 mt-1">{t('home.totalVotes')}</p>
          </div>
        </div>
      </div>

      {/* Recent Tenders & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8">
        {/* Recent Public Tenders */}
        <div className="card">
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 shrink-0" />
              <span className="truncate">{t('home.newTenders')}</span>
            </h2>
            <Link to="/map" className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0">
              {t('home.seeAllTenders')}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentTenders.length === 0 ? (
            <p className="text-gray-500 text-center py-6">{t('home.noTenders')}</p>
          ) : (
            <div className="space-y-4">
              {recentTenders.slice(0, 3).map((tender) => (
                <div 
                  key={tender.id} 
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {tender.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        {tender.budget && (
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            {formatCurrency(tender.budget)}
                          </span>
                        )}
                        {tender.contractor && (
                          <span className="flex items-center">
                            <Building className="h-4 w-4 mr-1" />
                            {tender.contractor}
                          </span>
                        )}
                      </div>
                      {tender.address && (
                        <p className="text-xs text-gray-500">{tender.address}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ml-4 ${
                      tender.status === 'active' ? 'bg-primary-100 text-primary-800' :
                      tender.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tender.status === 'active' ? t('status.active') : 
                       tender.status === 'completed' ? t('status.completed') : tender.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Council Votes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-2 min-w-0">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 shrink-0" />
              <span className="truncate">{t('home.recentCouncilVotes')}</span>
            </h2>
            <Link to="/council" className="flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0">
              {t('home.seeAllVotes')}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentVotes.length === 0 ? (
            <p className="text-gray-500 text-center py-6">{t('home.noVotes')}</p>
          ) : (
            <div className="space-y-4">
              {recentVotes.map((vote) => (
                <div key={vote.id} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                        {vote.proposal_title}
                      </h3>
                      <p className="text-sm text-gray-600 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(vote.session_date)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('home.voteFor')}: {vote.vote_yes} | {t('home.voteAgainst')}: {vote.vote_no} | {t('home.voteAbstain')}: {vote.vote_abstain}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ml-3 ${
                      vote.result === 'passed' ? 'bg-green-100 text-green-800' :
                      vote.result === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {vote.result === 'passed' ? t('home.votePassed') :
                       vote.result === 'rejected' ? t('home.voteRejected') : t('home.votePostponed')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* News & Events from starazagora.bg */}
      {(news.length > 0 || events.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* News */}
          {news.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
                <h2 className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 shrink-0" />
                  <span className="truncate">{t('home.newsFromMunicipality')}</span>
                </h2>
                <a href="https://www.starazagora.bg/bg/novini" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0">
                  {t('home.seeAllNews')}<ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="space-y-4">
                {news.map((item, i) => (
                  <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                    className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                    {item.image && (
                      <img src={item.image} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-primary-600">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(item.pubDate).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          {events.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
                <h2 className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-2 min-w-0">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 shrink-0" />
                  <span className="truncate">{t('home.eventsInCity')}</span>
                </h2>
                <a href="https://www.starazagora.bg/bg/sabitiya" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium text-xs sm:text-sm whitespace-nowrap shrink-0">
                  {t('home.seeAllEvents')}<ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="space-y-4">
                {events.map((item, i) => (
                  <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                    className="flex gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors group">
                    {item.image && (
                      <img src={item.image} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-orange-600">
                        {item.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(item.pubDate).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Citizen Services */}
      <div className="card mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-600" />
          {t('home.citizenServices')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Contact Information */}
          <div className="text-center p-4 bg-primary-50 rounded-xl">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Building className="h-6 w-6 text-primary-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('home.contacts')}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>{t('home.phone')}: 042 699 200</p>
              <p>{t('home.fax')}: 042 699 209</p>
              <p>info@starazagora.bg</p>
            </div>
          </div>

          {/* Office Hours */}
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('home.workingHours')}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>{t('home.workingHoursMonThu')}</p>
              <p>{t('home.workingHoursFri')}</p>
              <p>{t('home.citizenReception')}</p>
              <p>{t('home.citizenReceptionTime')}</p>
            </div>
          </div>

          {/* Online Services */}
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('home.onlineServices')}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>{t('home.onlineApplications')}</p>
              <p>{t('home.feesLookup')}</p>
              <p>{t('home.onlineDocs')}</p>
              <a href="#" className="text-purple-600 hover:text-purple-800 font-medium">{t('home.access')}</a>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Users className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('home.emergencyContacts')}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>042 699 299</p>
              <p>{t('home.dispatcher')}</p>
              <p>{t('home.dispatcher247')}</p>
              <p className="text-red-600 font-medium">{t('home.emergencyOnly')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency & Accountability */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-600" />
          {t('home.transparency')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Public Documents */}
          <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl border border-primary-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-200 rounded-lg">
                <FileText className="h-6 w-6 text-primary-700" />
              </div>
              <h3 className="text-lg font-semibold text-primary-900">{t('home.publicDocuments')}</h3>
            </div>
            <ul className="space-y-2 text-sm text-primary-800">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                {t('home.sessionMinutes')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                {t('home.municipalOrdinances')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                {t('home.strategicDocs')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full"></div>
                {t('home.activityReports')}
              </li>
            </ul>
            <button className="mt-4 w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
              {t('home.accessDocuments')}
            </button>
          </div>

          {/* Budget Transparency */}
          <Link to="/budget" className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-200 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-700" />
              </div>
              <h3 className="text-lg font-semibold text-green-900">{t('home.budgetTransparencyCard')}</h3>
            </div>
            <div className="space-y-3 text-sm text-green-800">
              <div className="flex justify-between items-center">
                <span>{t('home.totalBudgetLabel')}</span>
                <span className="font-semibold">{formatCurrency(stats.budget.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t('home.executionLabel')}</span>
                <span className="font-semibold">{Math.round((stats.budget.spent / stats.budget.total) * 100)}%</span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${(stats.budget.spent / stats.budget.total) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="mt-4 flex items-center text-green-700 font-medium text-sm">
              {t('home.detailedAnalysis')}
              <ArrowRight className="h-4 w-4 ml-1" />
            </div>
          </Link>

          {/* Public Participation */}
          <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-200 rounded-lg">
                <Users className="h-6 w-6 text-purple-700" />
              </div>
              <h3 className="text-lg font-semibold text-purple-900">{t('home.publicParticipation')}</h3>
            </div>
            <ul className="space-y-2 text-sm text-purple-800">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                {t('home.publicConsultations')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                {t('home.citizenConsultations')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                {t('home.proposalsSignals')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                {t('home.onlineSurveys')}
              </li>
            </ul>
            <button className="mt-4 w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
              {t('home.submitProposal')}
            </button>
          </div>
        </div>
      </div>

      {/* Footer Information */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Municipality Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('home.footerMunicipality')}</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t('home.footerAddress')}
              </p>
              <p className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                {t('home.footerBulstat')}
              </p>
              <p className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('home.footerCode')}
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('home.quickLinks')}</h3>
            <div className="space-y-2 text-sm">
              <Link to="/map" className="block text-gray-600 hover:text-primary-600 transition-colors">
                {t('home.projectMap')}
              </Link>
              <Link to="/budget" className="block text-gray-600 hover:text-primary-600 transition-colors">
                {t('home.municipalBudget')}
              </Link>
              <Link to="/council" className="block text-gray-600 hover:text-primary-600 transition-colors">
                {t('home.councilDecisionsLink')}
              </Link>
              <a href="https://starazagora.bg" target="_blank" rel="noopener noreferrer" className="block text-gray-600 hover:text-primary-600 transition-colors">
                {t('home.officialSite')}
              </a>
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('home.dataSources')}</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>ЦАИС ЕОП</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">{t('map.gisActive')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>OpenStreetMap</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">{t('map.gisActive')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('home.municipalData')}</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">{t('map.gisActive')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {t('home.dataAutoUpdate')}
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-500">
          <p>{t('home.copyright')}</p>
          <p className="mt-1">{t('home.platformDesc')}</p>
        </div>
      </div>
    </div>
    </>
  )
}

export default Home