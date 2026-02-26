/**
 * Budget Page
 * 
 * Visualizes municipal budget data using charts and tables.
 * Shows budget allocation by category with interactive charts.
 */

import { useState, useEffect } from 'react'
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
  ResponsiveContainer
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Filter,
  Download,
  PieChart as PieChartIcon,
  BarChart3
} from 'lucide-react'

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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
]

function BudgetPage() {
  const [budgetData, setBudgetData] = useState([])
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chartType, setChartType] = useState('pie') // 'pie' or 'bar'
  const [rawData, setRawData] = useState([])

  // Fetch budget data
  useEffect(() => {
    fetchBudgetData()
    fetchYears()
  }, [selectedYear])

  const fetchBudgetData = async () => {
    try {
      setLoading(true)
      
      // Fetch summary data for charts
      const summaryRes = await axios.get(
        `${API_URL}/budget/summary?year=${selectedYear}`
      )
      
      // Fetch detailed data for table
      const detailRes = await axios.get(
        `${API_URL}/budget?year=${selectedYear}&limit=1000`
      )

      const summary = summaryRes.data.data || []
      setBudgetData(summary)
      setRawData(detailRes.data.data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching budget data:', err)
      setError('Failed to load budget data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const fetchYears = async () => {
    try {
      const response = await axios.get(`${API_URL}/budget/years`)
      setYears(response.data.years || [new Date().getFullYear()])
    } catch (err) {
      console.error('Error fetching years:', err)
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

  // Format large numbers (millions)
  const formatMillions = (amount) => {
    return `${(amount / 1000000).toFixed(1)}M`
  }

  // Calculate total budget
  const totalBudget = budgetData.reduce(
    (sum, item) => sum + parseFloat(item.total_amount || 0),
    0
  )

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{data.category || label}</p>
          <p className="text-primary-600">
            {formatCurrency(data.total_amount || data.value)}
          </p>
          <p className="text-sm text-gray-500">
            {data.percentage || Math.round((data.value / totalBudget) * 100)}% of total
          </p>
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
          onClick={fetchBudgetData}
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
          <h1 className="text-3xl font-bold text-gray-900">Municipal Budget</h1>
          <p className="text-gray-600 mt-1">
            Budget allocation and spending by category
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Budget</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(totalBudget)}
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <DollarSign className="h-8 w-8 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {budgetData.length}
              </p>
            </div>
            <div className="p-3 bg-secondary-100 rounded-lg">
              <Filter className="h-8 w-8 text-secondary-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Largest Category</p>
              <p className="text-xl font-bold text-gray-900 mt-2">
                {budgetData[0]?.category || 'N/A'}
              </p>
              <p className="text-sm text-gray-500">
                {budgetData[0] && formatCurrency(budgetData[0].total_amount)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Budget Distribution</h2>
          
          {/* Chart Type Toggle */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setChartType('pie')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all ${
                chartType === 'pie'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PieChartIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Pie</span>
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all ${
                chartType === 'bar'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm font-medium">Bar</span>
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={budgetData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => `${category} (${percentage}%)`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="total_amount"
                  nameKey="category"
                >
                  {budgetData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            ) : (
              <BarChart
                data={budgetData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis 
                  tickFormatter={(value) => formatMillions(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_amount" name="Budget Amount">
                  {budgetData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Budget Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Budget Details</h2>
          <button className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium">
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Category
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">
                  Amount
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">
                  Percentage
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">
                  Items
                </th>
              </tr>
            </thead>
            <tbody>
              {budgetData.map((item, index) => (
                <tr 
                  key={item.category} 
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded mr-3"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="font-medium text-gray-900">
                        {item.category}
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 font-medium text-gray-900">
                    {formatCurrency(item.total_amount)}
                  </td>
                  <td className="text-right py-3 px-4">
                    <div className="flex items-center justify-end">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                        <div 
                          className="h-2 rounded-full"
                          style={{ 
                            width: `${item.percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length]
                          }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">
                        {item.percentage}%
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-600">
                    {item.item_count}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="py-3 px-4 text-gray-900">Total</td>
                <td className="text-right py-3 px-4 text-gray-900">
                  {formatCurrency(totalBudget)}
                </td>
                <td className="text-right py-3 px-4 text-gray-900">100%</td>
                <td className="text-right py-3 px-4 text-gray-900">
                  {budgetData.reduce((sum, item) => sum + parseInt(item.item_count), 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Raw Budget Items */}
      {rawData.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Individual Budget Items
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {rawData.map((item) => (
              <div 
                key={item.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: COLORS[
                            budgetData.findIndex(b => b.category === item.category) % COLORS.length
                          ] 
                        }}
                      ></span>
                      <span className="text-sm font-medium text-gray-600">
                        {item.category}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-1">
                      {item.description || 'No description'}
                    </h3>
                  </div>
                  <span className="font-bold text-gray-900 ml-4">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BudgetPage
