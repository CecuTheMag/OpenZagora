/**
 * Home Page / Dashboard
 * 
 * Main dashboard showing overview statistics, recent projects,
 * and quick access to all sections of the application.
 */

import { useLanguage } from '../contexts/LanguageContext.jsx'
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
  const [upcomingMeetings, setUpcomingMeetings] = useState([])
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
      
      // Fetch votes statistics
      const votesRes = await axios.get(`${API_URL}/votes/statistics`)

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
          recent: votesRes.data?.recent?.length || 0
        }
      })

      setRecentTenders(recentEopData)
      setRecentProjects(projectsRes.data?.data || [])
      
      // Mock upcoming meetings (would be real data)
      setUpcomingMeetings([
        {
          id: 1,
          title: 'Редовна сесия на Общински съвет',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
          type: 'council'
        },
        {
          id: 2,
          title: 'Обществено обсъждане - бюджет 2024',
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // In 2 weeks
          type: 'public'
        }
      ])
      
      setLastUpdated(new Date())
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
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl text-white p-8 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl font-bold mb-4">
              Община Стара Загора
            </h1>
            <p className="text-xl text-primary-100 mb-6">
              Прозрачност и отворено управление за всички граждани
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{stats.municipality.population.toLocaleString('bg-BG')} жители</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{stats.municipality.area} км²</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span>{stats.municipality.districts} района</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{stats.tenders.active}</div>
              <div className="text-sm text-primary-100">Активни обществени поръчки</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{formatCurrency(stats.budget.total)}</div>
              <div className="text-sm text-primary-100">Общ бюджет 2024</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{stats.projects.active}</div>
              <div className="text-sm text-primary-100">Текущи проекти</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{stats.votes.total}</div>
              <div className="text-sm text-primary-100">Решения на ОС</div>
            </div>
          </div>
        </div>
        {lastUpdated && (
          <div className="mt-6 pt-4 border-t border-primary-500/30 text-sm text-primary-100">
            Последно обновяване: {lastUpdated.toLocaleString('bg-BG')}
          </div>
        )}
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Public Tenders */}
        <Link to="/map" className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Обществени поръчки</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.tenders.total}
              </p>
              <div className="flex items-center mt-2 space-x-3 text-sm">
                <span className="text-blue-600 font-medium">
                  {stats.tenders.active} активни
                </span>
                <span className="text-green-600">
                  {stats.tenders.completed} завършени
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Обща стойност: {formatCurrency(stats.tenders.totalValue)}
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </Link>

        {/* Budget Execution */}
        <Link to="/budget" className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Изпълнение на бюджета</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {Math.round((stats.budget.spent / stats.budget.total) * 100)}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${(stats.budget.spent / stats.budget.total) * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Изразходвано: {formatCurrency(stats.budget.spent)}
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Link>

        {/* Council Decisions */}
        <Link to="/council" className="card hover:shadow-lg transition-all duration-200 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Решения на ОС</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.votes.total}
              </p>
              <div className="flex items-center mt-2 space-x-3 text-sm">
                <span className="text-green-600 font-medium">
                  {stats.votes.passed} приети
                </span>
                <span className="text-gray-500">
                  {stats.votes.total - stats.votes.passed} отхвърлени
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Последни 30 дни: {stats.votes.recent} решения
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </Link>

        {/* Quick Access */}
        <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-all duration-200">
          <div className="text-center">
            <div className="p-3 bg-orange-200 rounded-lg w-fit mx-auto mb-3">
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-sm font-medium text-orange-800 mb-2">Предстоящи събития</p>
            <p className="text-2xl font-bold text-orange-900">
              {upcomingMeetings.length}
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Следващите 7 дни
            </p>
          </div>
        </div>
      </div>

      {/* Recent Tenders & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Public Tenders */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Нови обществени поръчки
            </h2>
            <Link 
              to="/map" 
              className="flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Виж всички
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {recentTenders.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Няма нови обществени поръчки</p>
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
                      tender.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      tender.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tender.status === 'active' ? 'Активна' : 
                       tender.status === 'completed' ? 'Завършена' : tender.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Meetings */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              Предстоящи събития
            </h2>
          </div>

          <div className="space-y-4">
            {upcomingMeetings.map((meeting) => (
              <div 
                key={meeting.id} 
                className="p-4 bg-orange-50 border border-orange-200 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {meeting.title}
                    </h3>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {meeting.date.toLocaleDateString('bg-BG', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    meeting.type === 'council' ? 'bg-purple-100 text-purple-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {meeting.type === 'council' ? 'Общински съвет' : 'Обществено обсъждане'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Citizen Services */}
      <div className="card mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-600" />
          Услуги за граждани
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Contact Information */}
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Building className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Контакти</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>тел: 042 699 200</p>
              <p>факс: 042 699 209</p>
              <p>info@starazagora.bg</p>
            </div>
          </div>

          {/* Office Hours */}
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Работно време</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Пон-Чет: 08:30-17:30</p>
              <p>Петък: 08:30-16:30</p>
              <p>Граждански приемен:</p>
              <p>Вторник: 14:00-17:00</p>
            </div>
          </div>

          {/* Online Services */}
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Онлайн услуги</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Електронни заявления</p>
              <p>Справки за такси</p>
              <p>Документи онлайн</p>
              <a href="#" className="text-purple-600 hover:text-purple-800 font-medium">Достъп →</a>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Users className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Спешни контакти</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Авария: 042 699 299</p>
              <p>Дежурен инженер</p>
              <p>24/7 диспечер</p>
              <p className="text-red-600 font-medium">Само спешни случаи</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency & Accountability */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-600" />
          Прозрачност и отчетност
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Public Documents */}
          <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-200 rounded-lg">
                <FileText className="h-6 w-6 text-blue-700" />
              </div>
              <h3 className="text-lg font-semibold text-blue-900">Публични документи</h3>
            </div>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Протоколи от заседания
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Общински наредби
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Стратегически документи
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Отчети за дейността
              </li>
            </ul>
            <button className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              Достъп до документи
            </button>
          </div>

          {/* Budget Transparency */}
          <Link to="/budget" className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-200 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-700" />
              </div>
              <h3 className="text-lg font-semibold text-green-900">Бюджетна прозрачност</h3>
            </div>
            <div className="space-y-3 text-sm text-green-800">
              <div className="flex justify-between items-center">
                <span>Общ бюджет 2024:</span>
                <span className="font-semibold">{formatCurrency(stats.budget.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Изпълнение:</span>
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
              Подробна анализа
              <ArrowRight className="h-4 w-4 ml-1" />
            </div>
          </Link>

          {/* Public Participation */}
          <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-200 rounded-lg">
                <Users className="h-6 w-6 text-purple-700" />
              </div>
              <h3 className="text-lg font-semibold text-purple-900">Обществено участие</h3>
            </div>
            <ul className="space-y-2 text-sm text-purple-800">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                Обществени обсъждания
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                Консултации с граждани
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                Предложения и сигнали
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                Онлайн анкети
              </li>
            </ul>
            <button className="mt-4 w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
              Подай предложение
            </button>
          </div>
        </div>
      </div>

      {/* Footer Information */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Municipality Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Община Стара Загора</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                ул. "Цар Симеон Велики" 107, 6000 Стара Загора
              </p>
              <p className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                БУЛСТАТ: 000695324
              </p>
              <p className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Общински код: SZ
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Бързи връзки</h3>
            <div className="space-y-2 text-sm">
              <Link to="/map" className="block text-gray-600 hover:text-primary-600 transition-colors">
                Карта на проектите
              </Link>
              <Link to="/budget" className="block text-gray-600 hover:text-primary-600 transition-colors">
                Общински бюджет
              </Link>
              <Link to="/council" className="block text-gray-600 hover:text-primary-600 transition-colors">
                Решения на ОС
              </Link>
              <a href="https://starazagora.bg" target="_blank" rel="noopener noreferrer" className="block text-gray-600 hover:text-primary-600 transition-colors">
                Официален сайт
              </a>
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Източници на данни</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>ЦАИС ЕОП</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Активно</span>
              </div>
              <div className="flex items-center justify-between">
                <span>OpenStreetMap</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Активно</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Общински данни</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Активно</span>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Данните се обновяват автоматично всеки час
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-500">
          <p>
            © 2024 Община Стара Загора. Всички права запазени.
          </p>
          <p className="mt-1">
            Платформа за открито управление и прозрачност
          </p>
        </div>
      </div>
    </div>
    </>
  )
}

export default Home