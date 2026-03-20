/**
 * Council Page
 * Municipal council voting records and participation analytics.
 */

import { useLanguage } from '../contexts/LanguageContext.jsx'
import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts'
import {
  Users, CheckCircle, XCircle, MinusCircle,
  Calendar, Search, Filter, Gavel, FileText
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function CouncilPage() {
  const { t, language } = useLanguage()
  const [votes, setVotes] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [resultFilter, setResultFilter] = useState('all')

  useEffect(() => {
    fetchVotes()
    fetchStatistics()
    fetchYears()
  }, [selectedYear])

  const fetchVotes = async () => {
    try {
      setLoading(true)
      const url = selectedYear === 'all'
        ? `${API_URL}/votes?limit=100`
        : `${API_URL}/votes?year=${selectedYear}&limit=100`
      const response = await axios.get(url)
      setVotes(response.data.data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching votes:', err)
      setError(t('council.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const fetchStatistics = async () => {
    try {
      const url = selectedYear !== 'all'
        ? `${API_URL}/votes/statistics?year=${selectedYear}`
        : `${API_URL}/votes/statistics`
      const response = await axios.get(url)
      setStatistics(response.data)
    } catch (err) {
      try {
        const r = await axios.get(`${API_URL}/votes/statistics`)
        setStatistics(r.data)
      } catch {}
    }
  }

  const fetchYears = async () => {
    try {
      const response = await axios.get(`${API_URL}/votes/years`)
      setYears(response.data.years || [])
    } catch {}
  }

  const filteredVotes = votes.filter((vote) => {
    const matchesSearch = searchQuery === '' ||
      vote.proposal_title?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesResult = resultFilter === 'all' || vote.result === resultFilter
    return matchesSearch && matchesResult
  })

  const locale = language === 'bg' ? 'bg-BG' : 'en-GB'

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  const formatDateShort = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  const getParticipationPercentage = (vote) => {
    const total = (vote.vote_yes || 0) + (vote.vote_no || 0) + (vote.vote_abstain || 0)
    return Math.round((total / 41) * 100)
  }

  const resultConfig = {
    passed:    { badge: 'bg-green-100 text-green-800 border border-green-200',  icon: <CheckCircle  className="h-3.5 w-3.5 mr-1" /> },
    rejected:  { badge: 'bg-red-100 text-red-800 border border-red-200',        icon: <XCircle      className="h-3.5 w-3.5 mr-1" /> },
    postponed: { badge: 'bg-yellow-100 text-yellow-800 border border-yellow-200', icon: <MinusCircle className="h-3.5 w-3.5 mr-1" /> },
  }

  const resultLabel = {
    passed:    t('council.passed'),
    rejected:  t('council.rejected'),
    postponed: t('council.postponed'),
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mx-4">
        <p className="text-red-700 mb-4">{error}</p>
        <button onClick={fetchVotes} className="btn-primary">{t('common.retry')}</button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('council.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('council.description')}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="input-field text-sm py-1.5"
          >
            <option value="all">{t('council.allYears')}</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {statistics?.overall && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: t('council.totalVotes'),
              value: statistics.overall.total_votes,
              sub: null,
              icon: <Gavel className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />,
              bg: 'bg-primary-100',
              color: 'text-gray-900'
            },
            {
              label: t('council.passed'),
              value: statistics.overall.passed_count,
              sub: null,
              icon: <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />,
              bg: 'bg-green-100',
              color: 'text-green-600'
            },
            {
              label: t('council.rejected'),
              value: statistics.overall.rejected_count,
              sub: null,
              icon: <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />,
              bg: 'bg-red-100',
              color: 'text-red-600'
            },
            {
              label: t('council.avgParticipation'),
              value: Math.round(statistics.overall.avg_participation || 0),
              sub: t('council.councilMembers'),
              icon: <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />,
              bg: 'bg-purple-100',
              color: 'text-gray-900'
            },
          ].map(({ label, value, sub, icon, bg, color }) => (
            <div key={label} className="card p-3 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{label}</p>
                  <p className={`text-xl sm:text-3xl font-bold mt-1 ${color}`}>{value}</p>
                  {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
                </div>
                <div className={`p-2 sm:p-3 rounded-lg shrink-0 ${bg}`}>{icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {statistics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="card p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{t('council.monthlyActivity')}</h2>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statistics.monthlyBreakdown} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => t(`council.months.${v}`)}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(v) => t(`council.monthsFull.${v}`)}
                    formatter={(value, name) => [value, name === 'passed' ? t('council.chartPassed') : t('council.chartRejected')]}
                  />
                  <Bar dataKey="passed" fill="#22c55e" name="passed" radius={[3,3,0,0]} />
                  <Bar dataKey="rejected" fill="#ef4444" name="rejected" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{t('council.participationTrends')}</h2>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statistics.participationTrends} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="session_date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatDateShort}
                  />
                  <YAxis domain={[0, 41]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={formatDate}
                    formatter={(value, name) => {
                      const labels = {
                        total_participation: t('council.chartTotal'),
                        vote_yes: t('council.chartYes'),
                        vote_no: t('council.chartNo'),
                      }
                      return [value, labels[name] || name]
                    }}
                  />
                  <Line type="monotone" dataKey="total_participation" stroke="#3b82f6" strokeWidth={2} dot={false} name="total_participation" />
                  <Line type="monotone" dataKey="vote_yes" stroke="#22c55e" strokeWidth={2} dot={false} name="vote_yes" />
                  <Line type="monotone" dataKey="vote_no" stroke="#ef4444" strokeWidth={2} dot={false} name="vote_no" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('council.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 shrink-0" />
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="input-field text-sm py-1.5 flex-1 sm:w-40"
            >
              <option value="all">{t('council.allResults')}</option>
              <option value="passed">{t('council.passed')}</option>
              <option value="rejected">{t('council.rejected')}</option>
              <option value="postponed">{t('council.postponed')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Votes List */}
      <div className="card p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">
          {t('council.votingRecords')}
          <span className="text-xs sm:text-sm font-normal text-gray-500 ml-2">
            ({t('council.of', { count: filteredVotes.length, total: votes.length })})
          </span>
        </h2>

        <div className="space-y-3 sm:space-y-4">
          {filteredVotes.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">{t('council.noRecords')}</p>
          ) : (
            filteredVotes.map((vote) => {
              const cfg = resultConfig[vote.result] || resultConfig.postponed
              const pct = getParticipationPercentage(vote)
              return (
                <div
                  key={vote.id}
                  className="p-3 sm:p-5 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
                >
                  {/* Top row: icon + title + badge */}
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg shrink-0 mt-0.5">
                      <FileText className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-snug">
                        {vote.proposal_title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="flex items-center text-xs text-gray-500">
                          <Calendar className="h-3.5 w-3.5 mr-1" />
                          {formatDate(vote.session_date)}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                          {cfg.icon}
                          {resultLabel[vote.result] || vote.result}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Vote counts */}
                  <div className="flex items-center gap-4 sm:gap-8 mt-3 pl-0 sm:pl-11">
                    {[
                      { label: t('council.yes'),     value: vote.vote_yes,     color: 'text-green-600' },
                      { label: t('council.no'),      value: vote.vote_no,      color: 'text-red-600'   },
                      { label: t('council.abstain'), value: vote.vote_abstain, color: 'text-gray-500'  },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <p className={`text-lg sm:text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Participation bar */}
                  <div className="mt-3 sm:pl-11">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{t('council.participation')}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-primary-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Raw text */}
                  {vote.raw_text && (
                    <div className="mt-3 pt-3 border-t border-gray-200 sm:pl-11">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-primary-600 hover:text-primary-700 font-medium text-xs sm:text-sm">
                          {t('council.viewOriginal')}
                        </summary>
                        <p className="mt-2 text-gray-600 whitespace-pre-wrap font-mono text-xs bg-gray-100 p-3 rounded-lg">
                          {vote.raw_text.substring(0, 500)}
                          {vote.raw_text.length > 500 && '...'}
                        </p>
                      </details>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default CouncilPage
