/**
 * Budget Page - Enhanced Version with Professional Tables
 * 
 * Visualizes municipal budget data using tabs for different categories:
 * - Summary: Overview with charts and detailed tables
 * - Income: Detailed income items from pr1 documents
 * - Expenses: Detailed expenses from pr2 documents
 * - Indicators: Budget indicators from dxxx documents
 * - Loans: Loan information from loan documents
 * - Documents: List of uploaded budget documents
 */

import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  Search,
  FileText,
  PieChart as PieChartIcon,
  BarChart3,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Wallet,
  Building,
  CreditCard,
  FolderOpen,
  Home,
  Users,
  Plane,
  Bus,
  Heart,
  BookOpen,
  Lightbulb,
  TreePine,
  MapPin,
  TrendingUp as TrendIcon,
  Percent,
  Activity,
  Target,
  Layers,
  PieChart as ChartPie,
  Table,
  X,
  ExternalLink,
  Maximize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

// API base URLs
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001/api'

// Color palette for charts
const COLORS = [
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
]

// Function colors for expenses
const FUNCTION_COLORS = {
  '01': '#3b82f6', // General government services
  '02': '#22c55e', // Defense
  '03': '#f59e0b', // Public order
  '04': '#ef4444', // Education
  '05': '#8b5cf6', // Health
  '06': '#ec4899', // Social welfare
  '07': '#06b6d4', // Housing
  '08': '#84cc16', // Recreation
  '09': '#f97316', // Religion
  '10': '#6366f1', // Agriculture
  '11': '#14b8a6', // Industry
  '12': '#a855f7', // Transport
  '13': '#ec4899', // Communications
  '14': '#f59e0b', // Other
}

// Tab definitions
const TABS = [
  { id: 'summary', label: 'Summary', icon: PieChartIcon },
  { id: 'income', label: 'Income', icon: ArrowUpDown },
  { id: 'expenses', label: 'Expenses', icon: Building },
  { id: 'indicators', label: 'Indicators', icon: BarChart3 },
  { id: 'loans', label: 'Loans', icon: CreditCard },
  { id: 'villages', label: 'Villages', icon: MapPin },
  { id: 'forecasts', label: 'Forecasts', icon: TrendIcon },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
]

// Population estimate for Stara Zagora municipality (can be updated from actual data)
const MUNICIPALITY_POPULATION = 320000

function BudgetPage() {
  const [activeTab, setActiveTab] = useState('summary')
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Data states
  const [incomeData, setIncomeData] = useState([])
  const [expenseData, setExpenseData] = useState([])
  const [indicatorData, setIndicatorData] = useState([])
  const [loanData, setLoanData] = useState([])
  const [villageData, setVillageData] = useState([])
  const [forecastData, setForecastData] = useState([])
  const [documentData, setDocumentData] = useState([])
  const [summaryData, setSummaryData] = useState(null)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'amount', direction: 'desc' })
  const [chartType, setChartType] = useState('bar')
  const [categoryFilter, setCategoryFilter] = useState('all')
  
  // Fetch all data
  useEffect(() => {
    fetchAllData()
  }, [selectedYear])

  const fetchAllData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [
        yearsRes,
        incomeRes,
        expenseRes,
        indicatorRes,
        loanRes,
        villageRes,
        forecastRes,
        documentRes,
        summaryRes
      ] = await Promise.all([
        axios.get(`${API_URL}/budget/years`),
        axios.get(`${API_URL}/budget/income?year=${selectedYear}`),
        axios.get(`${API_URL}/budget/expenses?year=${selectedYear}`),
        axios.get(`${API_URL}/budget/indicators?year=${selectedYear}`),
        axios.get(`${API_URL}/budget/loans?year=${selectedYear}`),
        axios.get(`${API_URL}/budget/villages?year=${selectedYear}`),
        axios.get(`${API_URL}/budget/forecasts`),
        axios.get(`${API_URL}/budget/documents?year=${selectedYear}&limit=100`),
        axios.get(`${API_URL}/budget/summary?year=${selectedYear}`)
      ])
      
      setYears(yearsRes.data.data?.years || [selectedYear])
      setIncomeData(incomeRes.data.data || [])
      setExpenseData(expenseRes.data.data || [])
      setIndicatorData(indicatorRes.data.data || [])
      setLoanData(loanRes.data.data || [])
      setVillageData(villageRes.data.data || [])
      setForecastData(forecastRes.data.data || [])
      setDocumentData(documentRes.data.data || [])
      setSummaryData(summaryRes.data)
      
    } catch (err) {
      console.error('Error fetching budget data:', err)
      setError('Failed to load budget data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A'
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: 'BGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Format large numbers (millions)
  const formatMillions = (amount) => {
    if (!amount) return '0'
    return `${(amount / 1000000).toFixed(1)}M`
  }

  // Format percentage
  const formatPercent = (value) => {
    if (value === null || value === undefined) return 'N/A'
    return `${value}%`
  }

  // Calculate totals - ensure all values are numbers
  const totals = useMemo(() => {
    const totalIncome = incomeData?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0
    const totalExpenses = expenseData?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0
    const totalIndicators = indicatorData?.reduce((sum, item) => sum + parseFloat(item.amount_approved || 0), 0) || 0
    const totalLoans = loanData?.reduce((sum, item) => sum + parseFloat(item.original_amount || 0), 0) || 0

    return {
      income: totalIncome || 0,
      expenses: totalExpenses || 0,
      indicators: totalIndicators || 0,
      loans: totalLoans || 0,
      balance: (totalIncome || 0) - (totalExpenses || 0),
      utilizationRate: (totalIncome || 0) > 0 ? (((totalExpenses || 0) / (totalIncome || 1)) * 100).toFixed(1) : '0',
      perCapita: (totalExpenses || 0) / MUNICIPALITY_POPULATION
    }
  }, [incomeData, expenseData, indicatorData, loanData])

  // Filter and sort data
  const filterAndSortData = (data, searchKey = 'name', amountKey = 'amount') => {
    let filtered = [...data]
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => 
        (item[searchKey] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => 
        (item.code || '').startsWith(categoryFilter) ||
        (item.function_code || '').startsWith(categoryFilter)
      )
    }
    
    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key] || 0
      const bVal = b[sortConfig.key] || 0
      
      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })
    
    return filtered
  }

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  // Export to CSV
  const exportToCSV = (data, filename) => {
    if (!data.length) return
    
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h]
          // Escape quotes and wrap in quotes if contains comma
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return val
        }).join(',')
      )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${selectedYear}.csv`
    link.click()
  }

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload || {}
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <p className="font-semibold text-gray-900">{data.name || label}</p>
          <p className="text-primary-600 font-medium mt-1">
            {formatCurrency(data.value || data.amount || data.total_amount)}
          </p>
          {data.percentage !== undefined && (
            <p className="text-sm text-gray-500">
              {data.percentage}% of total
            </p>
          )}
        </div>
      )
    }
    return null
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
          onClick={fetchAllData}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
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
          <h1 className="text-3xl font-bold text-gray-900">Municipal Budget {selectedYear}</h1>
          <p className="text-gray-600 mt-1">
            Budget allocation, spending, and financial reports
          </p>
        </div>

        {/* Year Selector */}
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <SummaryTab 
          totals={totals}
          incomeData={incomeData}
          expenseData={expenseData}
          indicatorData={indicatorData}
          loanData={loanData}
          villageData={villageData}
          chartType={chartType}
          setChartType={setChartType}
          formatCurrency={formatCurrency}
          formatMillions={formatMillions}
          formatPercent={formatPercent}
          CustomTooltip={CustomTooltip}
          COLORS={COLORS}
          FUNCTION_COLORS={FUNCTION_COLORS}
          selectedYear={selectedYear}
        />
      )}

      {activeTab === 'income' && (
        <IncomeTab 
          data={filterAndSortData(incomeData, 'name', 'amount')}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortConfig={sortConfig}
          handleSort={handleSort}
          formatCurrency={formatCurrency}
          exportToCSV={exportToCSV}
          selectedYear={selectedYear}
        />
      )}

      {activeTab === 'expenses' && (
        <ExpensesTab 
          data={filterAndSortData(expenseData, 'function_name', 'amount')}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortConfig={sortConfig}
          handleSort={handleSort}
          formatCurrency={formatCurrency}
          exportToCSV={exportToCSV}
          selectedYear={selectedYear}
          FUNCTION_COLORS={FUNCTION_COLORS}
        />
      )}

      {activeTab === 'indicators' && (
        <IndicatorsTab 
          data={filterAndSortData(indicatorData, 'department_name', 'amount_approved')}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortConfig={sortConfig}
          handleSort={handleSort}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          exportToCSV={exportToCSV}
          selectedYear={selectedYear}
        />
      )}

      {activeTab === 'loans' && (
        <LoansTab 
          data={filterAndSortData(loanData, 'creditor', 'original_amount')}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortConfig={sortConfig}
          handleSort={handleSort}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          exportToCSV={exportToCSV}
          selectedYear={selectedYear}
        />
      )}

      {activeTab === 'villages' && (
        <VillagesTab 
          data={filterAndSortData(villageData, 'name', 'total_amount')}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortConfig={sortConfig}
          handleSort={handleSort}
          formatCurrency={formatCurrency}
          exportToCSV={exportToCSV}
          selectedYear={selectedYear}
        />
      )}

      {activeTab === 'forecasts' && (
        <ForecastsTab 
          data={filterAndSortData(forecastData, 'name', 'amount_2025')}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortConfig={sortConfig}
          handleSort={handleSort}
          formatCurrency={formatCurrency}
          exportToCSV={exportToCSV}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab 
          data={documentData}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          formatCurrency={formatCurrency}
          selectedYear={selectedYear}
        />
      )}
    </div>
  )
}

// ==========================================
// ENHANCED SUMMARY TAB COMPONENT
// ==========================================
function SummaryTab({ totals, incomeData, expenseData, indicatorData, loanData, villageData, chartType, setChartType, formatCurrency, formatMillions, formatPercent, CustomTooltip, COLORS, FUNCTION_COLORS, selectedYear }) {
  
  // Prepare income chart data grouped by category
  const incomeChartData = useMemo(() => {
    const grouped = {}
    incomeData.forEach(item => {
      const code = item.code?.split('-')[0] || '00'
      grouped[code] = (grouped[code] || 0) + parseFloat(item.amount || 0)
    })
    return Object.entries(grouped)
      .map(([code, value]) => ({ 
        name: getIncomeCategoryName(code), 
        value,
        code,
        percentage: totals.income > 0 ? ((value / totals.income) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.value - a.value)
  }, [incomeData, totals.income])

  // Prepare expense chart data grouped by function
  const expenseChartData = useMemo(() => {
    const grouped = {}
    expenseData.forEach(item => {
      const funcCode = item.function_code || '00'
      const funcName = item.function_name || getExpenseFunctionName(funcCode)
      if (!grouped[funcCode]) {
        grouped[funcCode] = { code: funcCode, name: funcName, value: 0 }
      }
      grouped[funcCode].value += parseFloat(item.amount || 0)
    })
    return Object.entries(grouped)
      .map(([code, data]) => ({ 
        ...data,
        percentage: totals.expenses > 0 ? ((data.value / totals.expenses) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.value - a.value)
  }, [expenseData, totals.expenses])

  // Top 5 income sources
  const topIncomeSources = useMemo(() => {
    return incomeData
      .map(item => ({
        code: item.code,
        name: item.name,
        amount: parseFloat(item.amount || 0)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [incomeData])

  // Top 5 expense categories
  const topExpenseCategories = useMemo(() => {
    const grouped = {}
    expenseData.forEach(item => {
      const funcCode = item.function_code || '00'
      const funcName = item.function_name || getExpenseFunctionName(funcCode)
      if (!grouped[funcCode]) {
        grouped[funcCode] = { code: funcCode, name: funcName, amount: 0 }
      }
      grouped[funcCode].amount += parseFloat(item.amount || 0)
    })
    return Object.values(grouped)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [expenseData])

  // Loan summary
  const loanSummary = useMemo(() => {
    const totalOriginal = loanData.reduce((sum, item) => sum + parseFloat(item.original_amount || 0), 0)
    const totalRemaining = loanData.reduce((sum, item) => sum + parseFloat(item.remaining_amount || 0), 0)
    return {
      count: loanData.length,
      totalOriginal,
      totalRemaining,
      totalToPay: totalOriginal - totalRemaining
    }
  }, [loanData])

  // Indicator summary
  const indicatorSummary = useMemo(() => {
    const totalApproved = indicatorData.reduce((sum, item) => sum + parseFloat(item.amount_approved || 0), 0)
    const totalExecuted = indicatorData.reduce((sum, item) => sum + parseFloat(item.amount_executed || 0), 0)
    return {
      count: indicatorData.length,
      totalApproved,
      totalExecuted,
      executionRate: totalApproved > 0 ? ((totalExecuted / totalApproved) * 100).toFixed(1) : 0
    }
  }, [indicatorData])

  const balanceColor = totals.balance >= 0 ? 'text-green-600' : 'text-red-600'
  const balanceBg = totals.balance >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-orange-50 to-orange-100 border-orange-200'

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards - KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Total Income</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(totals.income)}</p>
              <p className="text-xs text-blue-600 mt-1">{incomeData.length} sources</p>
            </div>
            <div className="p-2 bg-blue-200 rounded-lg">
              <ArrowUpDown className="h-5 w-5 text-blue-700" />
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Total Expenses</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{formatCurrency(totals.expenses)}</p>
              <p className="text-xs text-red-600 mt-1">{expenseData.length} line items</p>
            </div>
            <div className="p-2 bg-red-200 rounded-lg">
              <TrendingDown className="h-5 w-5 text-red-700" />
            </div>
          </div>
        </div>

        {/* Budget Balance */}
        <div className={`bg-gradient-to-br rounded-xl p-5 border shadow-sm ${balanceBg}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-medium ${totals.balance >= 0 ? 'text-green-600' : 'text-orange-600'} uppercase tracking-wide`}>Budget Balance</p>
              <p className={`text-2xl font-bold mt-1 ${balanceColor}`}>{formatCurrency(totals.balance)}</p>
              <p className={`text-xs mt-1 ${totals.balance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                {totals.balance >= 0 ? 'Surplus' : 'Deficit'}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${totals.balance >= 0 ? 'bg-green-200' : 'bg-orange-200'}`}>
              {totals.balance >= 0 ? (
                <TrendingUp className={`h-5 w-5 ${totals.balance >= 0 ? 'text-green-700' : 'text-orange-700'}`} />
              ) : (
                <TrendingDown className={`h-5 w-5 ${totals.balance >= 0 ? 'text-green-700' : 'text-orange-700'}`} />
              )}
            </div>
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Utilization Rate</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">{totals.utilizationRate}%</p>
              <div className="mt-2 w-full bg-purple-200 rounded-full h-1.5">
                <div 
                  className="h-1.5 rounded-full bg-purple-600"
                  style={{ width: `${Math.min(totals.utilizationRate, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="p-2 bg-purple-200 rounded-lg">
              <Percent className="h-5 w-5 text-purple-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Loans */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Active Loans</span>
            <CreditCard className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(loanSummary.totalOriginal)}</p>
          <p className="text-xs text-gray-500 mt-1">{loanSummary.count} loans • {formatCurrency(loanSummary.totalRemaining)} remaining</p>
        </div>

        {/* Village Budgets */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Village Allocations</span>
            <MapPin className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(villageData.reduce((s, v) => s + parseFloat(v.total_amount || 0), 0))}</p>
          <p className="text-xs text-gray-500 mt-1">{villageData.length} villages</p>
        </div>

        {/* Indicators Performance */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Indicators</span>
            <Target className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900">{indicatorSummary.executionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">{indicatorSummary.count} indicators • {formatCurrency(indicatorSummary.totalExecuted)} executed</p>
        </div>

        {/* Budget Health Score */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Budget Health</span>
            <Activity className="h-4 w-4 text-gray-400" />
          </div>
          <p className={`text-xl font-bold ${parseFloat(totals.utilizationRate) <= 100 ? 'text-green-600' : 'text-red-600'}`}>
            {parseFloat(totals.utilizationRate) <= 100 ? 'Good' : 'Over Budget'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{parseFloat(totals.utilizationRate) <= 100 ? `${(100 - parseFloat(totals.utilizationRate)).toFixed(1)}% remaining` : 'Expenses exceed income'}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Distribution Chart */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Income Distribution</h3>
            <span className="text-sm text-gray-500">{formatMillions(totals.income)} BGN</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={incomeChartData.slice(0, 6)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {incomeChartData.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={10}
                    formatter={(value, entry) => {
                      const item = incomeChartData.find(d => d.name === value)
                      return (
                        <span className="text-sm text-gray-700">
                          {value.length > 20 ? value.substring(0, 20) + '...' : value} 
                          <span className="ml-2 text-gray-500">({item?.percentage}%)</span>
                        </span>
                      )
                    }}
                  />
                </PieChart>
              ) : (
                <BarChart data={incomeChartData.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatMillions(v)} />
                  <YAxis type="category" dataKey="name" width={120} tick={{fontSize: 11}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Amount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Distribution Chart */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Expenses by Function</h3>
            <span className="text-sm text-gray-500">{formatMillions(totals.expenses)} BGN</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={expenseChartData.slice(0, 6)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {expenseChartData.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={FUNCTION_COLORS[entry.code] || COLORS[index % COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={10}
                    formatter={(value, entry) => {
                      const item = expenseChartData.find(d => d.name === value)
                      return (
                        <span className="text-sm text-gray-700">
                          {value.length > 20 ? value.substring(0, 20) + '...' : value}
                          <span className="ml-2 text-gray-500">({item?.percentage}%)</span>
                        </span>
                      )
                    }}
                  />
                </PieChart>
              ) : (
                <BarChart data={expenseChartData.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatMillions(v)} />
                  <YAxis type="category" dataKey="name" width={120} tick={{fontSize: 11}} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Amount" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart Type Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setChartType('pie')}
            className={`flex items-center space-x-1 px-4 py-2 rounded-md transition-all ${
              chartType === 'pie'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <PieChartIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Pie Chart</span>
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center space-x-1 px-4 py-2 rounded-md transition-all ${
              chartType === 'bar'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Bar Chart</span>
          </button>
        </div>
      </div>

      {/* Detailed Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Income Sources Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <ArrowUpDown className="h-5 w-5 text-blue-600 mr-2" />
              Top Income Sources
            </h3>
            <span className="text-sm text-gray-500">{topIncomeSources.length} of {incomeData.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Source</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Amount</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topIncomeSources.map((item, index) => (
                  <tr key={item.code || index} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 truncate max-w-[150px]" title={item.name}>
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
                          <div 
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${totals.income > 0 ? ((item.amount / totals.income) * 100) : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">
                          {totals.income > 0 ? ((item.amount / totals.income) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="py-3 px-4 text-gray-900 font-semibold" colSpan={2}>Total</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(topIncomeSources.reduce((s, i) => s + i.amount, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    {totals.income > 0 ? ((topIncomeSources.reduce((s, i) => s + i.amount, 0) / totals.income) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Top Expense Categories Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Building className="h-5 w-5 text-red-600 mr-2" />
              Top Expense Categories
            </h3>
            <span className="text-sm text-gray-500">{topExpenseCategories.length} functions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Function</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Amount</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topExpenseCategories.map((item, index) => (
                  <tr key={item.code || index} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span 
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: FUNCTION_COLORS[item.code] || '#6b7280' }}
                      >
                        {item.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 truncate max-w-[150px]" title={item.name}>
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
                          <div 
                            className="h-1.5 rounded-full"
                            style={{ 
                              width: `${totals.expenses > 0 ? ((item.amount / totals.expenses) * 100) : 0}%`,
                              backgroundColor: FUNCTION_COLORS[item.code] || '#6b7280'
                            }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">
                          {totals.expenses > 0 ? ((item.amount / totals.expenses) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="py-3 px-4 text-gray-900 font-semibold" colSpan={2}>Total</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(topExpenseCategories.reduce((s, i) => s + i.amount, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    {totals.expenses > 0 ? ((topExpenseCategories.reduce((s, i) => s + i.amount, 0) / totals.expenses) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Complete Income Breakdown Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Table className="h-5 w-5 text-primary-600 mr-2" />
            Complete Income Breakdown
          </h3>
          <span className="text-sm text-gray-500">{incomeData.length} line items</span>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Code</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Description</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Amount</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">% of Total</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Category Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {incomeData.map((item, index) => {
                const categoryCode = item.code?.split('-')[0] || '00'
                const categoryTotal = incomeChartData.find(c => c.code === categoryCode)?.value || 0
                return (
                  <tr key={item.id || index} className="hover:bg-gray-50">
                    <td className="py-2 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {item.code}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-700">{item.name}</td>
                    <td className="py-2 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-sm text-gray-600">
                        {totals.income > 0 ? ((item.amount / totals.income) * 100).toFixed(2) : 0}%
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end">
                        <div className="w-20 bg-gray-100 rounded-full h-1.5 mr-2">
                          <div 
                            className="h-1.5 rounded-full bg-blue-400"
                            style={{ width: `${categoryTotal > 0 ? ((item.amount / categoryTotal) * 100) : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {categoryTotal > 0 ? ((item.amount / categoryTotal) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
              <tr>
                <td className="py-3 px-4 text-gray-900" colSpan={2}>Total Income</td>
                <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(totals.income)}</td>
                <td className="py-3 px-4 text-right text-gray-900">100%</td>
                <td className="py-3 px-4 text-right text-gray-900">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Complete Expense Breakdown Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Table className="h-5 w-5 text-primary-600 mr-2" />
            Complete Expense Breakdown
          </h3>
          <span className="text-sm text-gray-500">{expenseData.length} line items</span>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Function</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Program</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">Amount</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-xs uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenseData.slice(0, 100).map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50">
                  <td className="py-2 px-4">
                    <div className="flex items-center">
                      <span 
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white mr-2"
                        style={{ backgroundColor: FUNCTION_COLORS[item.function_code] || '#6b7280' }}
                      >
                        {item.function_code}
                      </span>
                      <span className="text-sm text-gray-600">{item.function_name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-4 text-sm text-gray-700">{item.program_name || '-'}</td>
                  <td className="py-2 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-2 px-4 text-right">
                    <span className="text-sm text-gray-600">
                      {totals.expenses > 0 ? ((item.amount / totals.expenses) * 100).toFixed(2) : 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
              <tr>
                <td className="py-3 px-4 text-gray-900" colSpan={2}>Total Expenses</td>
                <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(totals.expenses)}</td>
                <td className="py-3 px-4 text-right text-gray-900">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {expenseData.length > 100 && (
          <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
            Showing 100 of {expenseData.length} items. Use search to filter.
          </div>
        )}
      </div>

    </div>
  )
}

// ==========================================
// INCOME TAB COMPONENT
// ==========================================
function IncomeTab({ data, searchTerm, setSearchTerm, sortConfig, handleSort, formatCurrency, exportToCSV, selectedYear }) {
  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search income items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{data.length} items</span>
          <span className="text-sm text-gray-600">•</span>
          <span className="text-sm font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
          <button
            onClick={() => exportToCSV(data, 'income')}
            className="flex items-center space-x-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">
                  <button 
                    onClick={() => handleSort('code')}
                    className="flex items-center space-x-1"
                  >
                    <span>Code</span>
                    {sortConfig.key === 'code' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">
                  <button 
                    onClick={() => handleSort('name')}
                    className="flex items-center space-x-1"
                  >
                    <span>Name</span>
                    {sortConfig.key === 'name' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">
                  <button 
                    onClick={() => handleSort('amount')}
                    className="flex items-center space-x-1 ml-auto"
                  >
                    <span>Amount</span>
                    {sortConfig.key === 'amount' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.code}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900">{item.name}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end">
                      <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${totalAmount > 0 ? ((item.amount / totalAmount) * 100) : 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">
                        {totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="py-3 px-4 text-gray-900" colSpan={2}>Total</td>
                <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(totalAmount)}</td>
                <td className="py-3 px-4 text-right text-gray-900">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No income data found for {selectedYear}
        </div>
      )}
    </div>
  )
}

// ==========================================
// EXPENSES TAB COMPONENT
// ==========================================
function ExpensesTab({ data, searchTerm, setSearchTerm, sortConfig, handleSort, formatCurrency, exportToCSV, selectedYear, FUNCTION_COLORS }) {
  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0)

  // Group by function
  const groupedByFunction = useMemo(() => {
    const grouped = {}
    data.forEach(item => {
      const funcCode = item.function_code || '00'
      if (!grouped[funcCode]) {
        grouped[funcCode] = {
          code: funcCode,
          name: item.function_name || getExpenseFunctionName(funcCode),
          amount: 0,
          items: []
        }
      }
      grouped[funcCode].amount += parseFloat(item.amount || 0)
      grouped[funcCode].items.push(item)
    })
    return Object.values(grouped).sort((a, b) => b.amount - a.amount)
  }, [data])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{data.length} items</span>
          <span className="text-sm text-gray-600">•</span>
          <span className="text-sm font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
          <button
            onClick={() => exportToCSV(data, 'expenses')}
            className="flex items-center space-x-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Function Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupedByFunction.slice(0, 6).map((func) => (
          <div 
            key={func.code}
            className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span 
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: FUNCTION_COLORS[func.code] || '#6b7280' }}
              >
                {func.code}
              </span>
              <span className="text-sm text-gray-500">
                {func.items.length} items
              </span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">{func.name}</h4>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(func.amount)}</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full"
                style={{ 
                  width: `${totalAmount > 0 ? ((func.amount / totalAmount) * 100) : 0}%`,
                  backgroundColor: FUNCTION_COLORS[func.code] || '#6b7280'
                }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {totalAmount > 0 ? ((func.amount / totalAmount) * 100).toFixed(1) : 0}% of total expenses
            </p>
          </div>
        ))}
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Function</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Program</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">Amount</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.slice(0, 50).map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: FUNCTION_COLORS[item.function_code] || '#6b7280' }}
                    >
                      {item.function_code}
                    </span>
                    <span className="ml-2 text-sm text-gray-600">{item.function_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-gray-900">{item.program_name}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-gray-600">
                      {totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > 50 && (
          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 text-center">
            Showing 50 of {data.length} items. Use search to filter.
          </div>
        )}
      </div>
    </div>
  )
}

// ==========================================
// INDICATORS TAB COMPONENT
// ==========================================
function IndicatorsTab({ data, searchTerm, setSearchTerm, sortConfig, handleSort, formatCurrency, formatPercent, exportToCSV, selectedYear }) {
  const totalApproved = data.reduce((sum, item) => sum + parseFloat(item.amount_approved || 0), 0)
  const totalExecuted = data.reduce((sum, item) => sum + parseFloat(item.amount_executed || 0), 0)

  // Group by indicator code
  const groupedByIndicator = useMemo(() => {
    const grouped = {}
    data.forEach(item => {
      const code = item.indicator_code || 'unknown'
      if (!grouped[code]) {
        grouped[code] = {
          code,
          name: item.indicator_name || getIndicatorName(code),
          approved: 0,
          executed: 0,
          items: []
        }
      }
      grouped[code].approved += parseFloat(item.amount_approved || 0)
      grouped[code].executed += parseFloat(item.amount_executed || 0)
      grouped[code].items.push(item)
    })
    return Object.values(grouped).sort((a, b) => b.approved - a.approved)
  }, [data])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search indicators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            <span className="text-gray-600">Approved: </span>
            <span className="font-medium text-gray-900">{formatCurrency(totalApproved)}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Executed: </span>
            <span className="font-medium text-green-600">{formatCurrency(totalExecuted)}</span>
          </div>
          <button
            onClick={() => exportToCSV(data, 'indicators')}
            className="flex items-center space-x-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Indicator Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {groupedByIndicator.slice(0, 8).map((ind) => (
          <div 
            key={ind.code}
            className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {ind.code.toUpperCase()}
              </span>
              <span className="text-sm text-gray-500">{ind.items.length} items</span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">{ind.name}</h4>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(ind.approved)}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-green-600">Executed: {formatCurrency(ind.executed)}</span>
              <span className="text-gray-500">
                {ind.approved > 0 ? ((ind.executed / ind.approved) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Indicator</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Department</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">Approved</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">Executed</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">% Exec.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.slice(0, 50).map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {item.indicator_code}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900">{item.indicator_name || getIndicatorName(item.indicator_code)}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(item.amount_approved)}
                  </td>
                  <td className="py-3 px-4 text-right text-green-600">
                    {formatCurrency(item.amount_executed)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      (item.percentage_executed || 0) >= 80 ? 'bg-green-100 text-green-800' :
                      (item.percentage_executed || 0) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {formatPercent(item.percentage_executed)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// LOANS TAB COMPONENT
// ==========================================
function LoansTab({ data, searchTerm, setSearchTerm, sortConfig, handleSort, formatCurrency, formatPercent, exportToCSV, selectedYear }) {
  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.original_amount || 0), 0)

  // Get unique loan types
  const loanTypes = [...new Set(data.map(d => d.loan_type).filter(Boolean))]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search loans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{data.length} loans</span>
          <span className="text-sm text-gray-600">•</span>
          <span className="text-sm font-medium text-gray-900">Total: {formatCurrency(totalAmount)}</span>
          <button
            onClick={() => exportToCSV(data, 'loans')}
            className="flex items-center space-x-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Loan Types Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loanTypes.slice(0, 4).map((type) => {
          const typeData = data.filter(d => d.loan_type === type)
          const typeTotal = typeData.reduce((sum, item) => sum + parseFloat(item.original_amount || 0), 0)
          
          return (
            <div 
              key={type}
              className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
            >
              <h4 className="font-semibold text-gray-900 mb-1">{type}</h4>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(typeTotal)}</p>
              <p className="text-sm text-gray-500 mt-1">{typeData.length} loans</p>
            </div>
          )
        })}
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Creditor</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">Original Amount</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">Remaining</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">Interest Rate</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Term</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      {item.loan_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900">{item.creditor}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(item.original_amount)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatCurrency(item.remaining_amount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.interest_rate ? formatPercent(item.interest_rate) : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {item.term_months ? `${item.term_months} months` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No loan data found for {selectedYear}
        </div>
      )}
    </div>
  )
}

// ==========================================
// VILLAGES TAB COMPONENT
// ==========================================
function VillagesTab({ data, searchTerm, setSearchTerm, sortConfig, handleSort, formatCurrency, exportToCSV, selectedYear }) {
  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search villages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{data.length} villages</span>
          <span className="text-sm text-gray-600">•</span>
          <span className="text-sm font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
          <button
            onClick={() => exportToCSV(data, 'villages')}
            className="flex items-center space-x-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Village Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.slice(0, 6).map((village) => (
          <div 
            key={village.id || village.code}
            className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {village.code}
              </span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">{village.name}</h4>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(village.total_amount)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">State:</span>
                <span className="ml-1 font-medium text-gray-700">{formatCurrency(village.state_personnel + village.state_maintenance)}</span>
              </div>
              <div>
                <span className="text-gray-500">Local:</span>
                <span className="ml-1 font-medium text-gray-700">{formatCurrency(village.local_total)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Code</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Village Name</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">State Funding</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">Local Budget</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {item.code}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900">{item.name}</td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatCurrency(item.state_personnel + item.state_maintenance)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {formatCurrency(item.local_total)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {formatCurrency(item.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="py-3 px-4" colSpan={4}>Total</td>
                <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No village data found for {selectedYear}
        </div>
      )}
    </div>
  )
}

// ==========================================
// FORECASTS TAB COMPONENT
// ==========================================
function ForecastsTab({ data, searchTerm, setSearchTerm, sortConfig, handleSort, formatCurrency, exportToCSV }) {
  const total2024 = data.reduce((sum, item) => sum + parseFloat(item.amount_2024 || 0), 0)
  const total2025 = data.reduce((sum, item) => sum + parseFloat(item.amount_2025 || 0), 0)
  const total2026 = data.reduce((sum, item) => sum + parseFloat(item.amount_2026 || 0), 0)
  const total2027 = data.reduce((sum, item) => sum + parseFloat(item.amount_2027 || 0), 0)
  const total2028 = data.reduce((sum, item) => sum + parseFloat(item.amount_2028 || 0), 0)

  const formatMillions = (amount) => {
    if (!amount) return '0'
    return `${(amount / 1000000).toFixed(1)}M`
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search forecasts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{data.length} items</span>
          <button
            onClick={() => exportToCSV(data, 'forecasts')}
            className="flex items-center space-x-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Forecast Year Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">2024 (Actual)</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(total2024)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">2025 (Plan)</p>
          <p className="text-xl font-bold text-blue-900">{formatCurrency(total2025)}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <p className="text-sm text-purple-600">2026 (Forecast)</p>
          <p className="text-xl font-bold text-purple-900">{formatCurrency(total2026)}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <p className="text-sm text-orange-600">2027 (Forecast)</p>
          <p className="text-xl font-bold text-orange-900">{formatCurrency(total2027)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">2028 (Forecast)</p>
          <p className="text-xl font-bold text-green-900">{formatCurrency(total2028)}</p>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Forecast Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[
              { year: '2024', amount: total2024 },
              { year: '2025', amount: total2025 },
              { year: '2026', amount: total2026 },
              { year: '2027', amount: total2027 },
              { year: '2028', amount: total2028 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis type="number" tickFormatter={(v) => formatMillions(v)} />
              <Tooltip />
              <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={{fill: '#3b82f6'}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Code</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Item Name</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900 text-sm">2024</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-900 text-sm">2025</th>
                <th className="text-right py-3 px-4 font-semibold text-purple-900 text-sm">2026</th>
                <th className="text-right py-3 px-4 font-semibold text-orange-900 text-sm">2027</th>
                <th className="text-right py-3 px-4 font-semibold text-green-900 text-sm">2028</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.slice(0, 50).map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {item.code}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900">{item.name}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(item.amount_2024)}</td>
                  <td className="py-3 px-4 text-right font-medium text-blue-900">{formatCurrency(item.amount_2025)}</td>
                  <td className="py-3 px-4 text-right text-purple-900">{formatCurrency(item.amount_2026)}</td>
                  <td className="py-3 px-4 text-right text-orange-900">{formatCurrency(item.amount_2027)}</td>
                  <td className="py-3 px-4 text-right text-green-900">{formatCurrency(item.amount_2028)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > 50 && (
          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 text-center">
            Showing 50 of {data.length} items. Use search to filter.
          </div>
        )}
      </div>

      {data.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No forecast data found
        </div>
      )}
    </div>
  )
}

// ==========================================
// DOCUMENTS TAB COMPONENT
// ==========================================
function DocumentsTab({ data, searchTerm, setSearchTerm, formatCurrency, selectedYear }) {
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  
  const filteredDocs = useMemo(() => {
    if (!searchTerm) return data
    return data.filter(doc => 
      doc.original_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_type?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  const getDocumentIcon = (type) => {
    switch (type) {
      case 'income': return ArrowUpDown
      case 'expense': return Building
      case 'indicator': return BarChart3
      case 'loan': return CreditCard
      case 'village': return MapPin
      case 'forecast': return TrendIcon
      default: return FileText
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'parsed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Get PDF URL - serves PDFs from budget-pdfs directory on main server
  const getPdfUrl = (doc) => {
    // Use filename if available (from admin uploads)
    if (doc.filename) {
      return `/api/files/${doc.filename}`
    }
    // Fallback to original_name - the server searches in budget-pdfs, uploads, and parsed directories
    if (doc.original_name) {
      return `/api/files/${doc.original_name}`
    }
    // Fallback to file_path
    if (doc.file_path) {
      return `/api/files${doc.file_path}`
    }
    return null
  }


  const handleDocClick = (doc) => {
    setSelectedDoc(doc)
    setPdfLoading(true)
  }

  const closeViewer = () => {
    setSelectedDoc(null)
    setPdfLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="text-sm text-gray-600">
          {filteredDocs.length} documents
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => {
          const Icon = getDocumentIcon(doc.document_type)
          return (
            <div 
              key={doc.id}
              onClick={() => handleDocClick(doc)}
              className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-lg hover:border-primary-300 cursor-pointer transition-all transform hover:scale-[1.02]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(doc.status)}`}>
                  {doc.status}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1 truncate" title={doc.original_name}>
                {doc.original_name}
              </h4>
              <div className="space-y-1 text-sm text-gray-500">
                <div className="flex items-center justify-between">
                  <span>Year:</span>
                  <span className="font-medium text-gray-700">{doc.year}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Type:</span>
                  <span className="font-medium text-gray-700">{doc.document_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Subtype:</span>
                  <span className="font-medium text-gray-700">{doc.document_subtype || 'N/A'}</span>
                </div>
                {doc.file_size && (
                  <div className="flex items-center justify-between">
                    <span>Size:</span>
                    <span className="font-medium text-gray-700">{(doc.file_size / 1024).toFixed(1)} KB</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center text-primary-600 text-sm font-medium">
                <FileText className="h-4 w-4 mr-1" />
                Click to view PDF
              </div>
            </div>
          )
        })}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {searchTerm ? 'No documents match your search' : `No documents found for ${selectedYear}`}
        </div>
      )}

      {/* Slide-in PDF Viewer Panel */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={closeViewer}
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-full md:w-[85%] lg:w-[75%] xl:w-[65%] bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-out">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-primary-400" />
                <div>
                  <h3 className="text-white font-semibold truncate max-w-md">{selectedDoc.original_name}</h3>
                  <p className="text-gray-400 text-xs">{selectedDoc.document_type} • {selectedDoc.year}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <a 
                  href={getPdfUrl(selectedDoc)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
                <button 
                  onClick={closeViewer}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="h-[calc(100%-60px)] bg-gray-100">
              {pdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent"></div>
                    <p className="text-gray-600 font-medium">Loading PDF...</p>
                  </div>
                </div>
              )}
              
              {getPdfUrl(selectedDoc) ? (
                <iframe 
                  src={getPdfUrl(selectedDoc)}
                  className="w-full h-full"
                  title="PDF Viewer"
                  onLoad={() => setPdfLoading(false)}
                  onError={() => setPdfLoading(false)}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">PDF not available</p>
                    <p className="text-gray-400 text-sm mt-1">The document file could not be found</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function getIncomeCategoryName(code) {
  const names = {
    '00': 'Общо приходи',
    '01': 'Данъци върху доходите',
    '02': 'Данъци върху печалбата', 
    '03': 'Данъци върху собствеността',
    '04': 'Данъци върху стоки и услуги',
    '05': 'Данъци върху външната търговия',
    '06': 'Други данъци',
    '08': 'Приходи от собственост',
    '09': 'Административни такси и услуги',
    '10': 'Глоби, санкции и наказателни лихви',
    '11': 'Доходи от концесии',
    '12': 'Приходи от продажби',
    '13': 'Имуществени данъци',
    '14': 'Приходи от лихви',
    '15': 'Други неданъчни приходи',
    '17': 'Временни безлихвени заеми',
    '24': 'Други приходи',
    '25': 'Приходи от глоби',
    '27': 'Общински такси',
    '28': 'Приходи от санкции',
    '31': 'Трансфери от централния бюджет',
    '36': 'Помощи от ЕС',
    '45': 'Текущи помощи',
    '46': 'Собствени приходи',
    '61': 'Трансфери между бюджети',
    '62': 'Трансфери от ЕС',
    '63': 'Други трансфери от ЕС',
    '74': 'Заеми от централния бюджет',
    '75': 'Заеми между бюджети',
    '76': 'Заеми за ЕС проекти',
    '77': 'Всичко заеми',
    '88': 'Друго финансиране',
    '93': 'Операции с финансови активи',
    '95': 'Депозити и средства по сметки'
  }
  return names[code] || `Категория ${code}`
}

function getExpenseFunctionName(code) {
  const names = {
    '00': 'Общо',
    '01': 'Общи държавни служби',
    '02': 'Отбрана и сигурност',
    '03': 'Обществен ред и безопасност',
    '04': 'Образование',
    '05': 'Здравеопазване',
    '06': 'Социално осигуряване',
    '07': 'Жилищно строителство',
    '08': 'Почивно дело, култура, религия',
    '09': 'Религиозни дейности',
    '10': 'Селско стопанство',
    '11': 'Промишленост',
    '12': 'Транспорт',
    '13': 'Комуникации',
    '14': 'Други икономически дейности',
    '15': 'Опазване на околната среда',
    '16': 'Научни изследвания'
  }
  return names[code] || `Функция ${code}`
}

function getIndicatorName(code) {
  const names = {
    'd122': 'Administrative Services',
    'd332': 'Social Services',
    'd369': 'Education',
    'd431': 'Healthcare',
    'd529': 'Sports',
    'd532': 'Healthcare Services',
    'd538': 'Cultural Activities',
    'd540': 'Youth Programs',
    'd604': 'Transport',
    'd619': 'Municipal Services',
    'd621': 'Environment',
    'd714': 'Energy',
    'd746': 'Water Supply',
    'd752': 'Waste Management',
    'd759': 'Public Works',
    'd849': 'Economic Development',
    'd898': 'Infrastructure'
  }
  return names[code] || `Indicator ${code}`
}

export default BudgetPage
