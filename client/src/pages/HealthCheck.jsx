import { useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export default function HealthCheck() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const checkHealth = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/health`)
      setResult({ success: true, data: res.data })
    } catch (error) {
      setResult({ success: false, error: error.message, details: error.response?.data })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Health Check</h1>
      <p className="mb-4">API_URL: <code className="bg-gray-100 px-2 py-1">{API_URL}</code></p>
      
      <button 
        onClick={checkHealth} 
        disabled={loading}
        className="btn-primary mb-4"
      >
        {loading ? 'Checking...' : 'Check API Health'}
      </button>

      {result && (
        <div className={`p-4 rounded ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
