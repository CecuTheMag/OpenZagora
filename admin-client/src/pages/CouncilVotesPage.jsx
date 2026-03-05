/**
 * Council Votes Management Page
 * 
 * Enterprise-grade council votes management interface for admin
 * Create, edit, delete and manage municipal council voting sessions
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Vote, Plus, Search, Filter, Edit2, Trash2, 
  Loader2, CheckCircle, AlertCircle, X, Save, 
  RefreshCw, Calendar, FileText, BarChart3
} from 'lucide-react';

// Result options
const RESULT_OPTIONS = [
  { value: 'passed', label: 'Passed', color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'postponed', label: 'Postponed', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'discussed', label: 'Discussed', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-800 border-gray-300' }
];

// Bulgarian months for display
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CouncilVotesPage = () => {
  const { user, api } = useAuth();
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Filters
  const [resultFilter, setResultFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [availableYears, setAvailableYears] = useState([]);
  
  // View mode
  const [viewMode, setViewMode] = useState('list');
  const [editingVote, setEditingVote] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    session_date: '',
    proposal_title: '',
    vote_yes: 0,
    vote_no: 0,
    vote_abstain: 0,
    result: 'passed',
    raw_text: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchVotes();
    fetchAvailableYears();
  }, []);

  const fetchVotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/admin/database/council_votes');
      if (response.data.success) {
        setVotes(response.data.data.records || []);
      } else {
        setError(response.data.error || 'Failed to fetch council votes');
      }
    } catch (err) {
      console.error('Error fetching council votes:', err);
      setError(err.response?.data?.message || 'Failed to fetch council votes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableYears = async () => {
    try {
      const response = await api.get('/api/admin/database/council_votes');
      if (response.data.success) {
        const records = response.data.data.records || [];
        const years = new Set(
          records
            .map(v => v.session_date ? new Date(v.session_date).getFullYear() : null)
            .filter(y => y !== null)
        );
        setAvailableYears([...years].sort((a, b) => b - a));
      }
    } catch (err) {
      console.error('Error fetching years:', err);
    }
  };

  const filteredVotes = votes.filter(vote => {
    const matchesResult = resultFilter === 'all' || vote.result === resultFilter;
    const matchesYear = yearFilter === 'all' || 
      (vote.session_date && new Date(vote.session_date).getFullYear().toString() === yearFilter);
    const matchesSearch = !searchQuery || 
      vote.proposal_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vote.raw_text?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesResult && matchesYear && matchesSearch;
  });

  const getStats = () => {
    const total = votes.length;
    const passed = votes.filter(v => v.result === 'passed').length;
    const rejected = votes.filter(v => v.result === 'rejected').length;
    const postponed = votes.filter(v => v.result === 'postponed').length;
    const totalYes = votes.reduce((sum, v) => sum + (parseInt(v.vote_yes) || 0), 0);
    const totalNo = votes.reduce((sum, v) => sum + (parseInt(v.vote_no) || 0), 0);
    const totalAbstain = votes.reduce((sum, v) => sum + (parseInt(v.vote_abstain) || 0), 0);
    
    return {
      total,
      passed,
      rejected,
      postponed,
      totalYes,
      totalNo,
      totalAbstain,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const getResultBadge = (result) => {
    const option = RESULT_OPTIONS.find(o => o.value === result);
    if (!option) return <span className="badge">{result}</span>;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${option.color}`}>
        {option.label}
      </span>
    );
  };

  const getTotalVotes = (vote) => {
    return (parseInt(vote.vote_yes) || 0) + 
           (parseInt(vote.vote_no) || 0) + 
           (parseInt(vote.vote_abstain) || 0);
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : parseInt(value)) : value
    }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleCreate = () => {
    setEditingVote(null);
    setFormData({
      session_date: new Date().toISOString().split('T')[0],
      proposal_title: '',
      vote_yes: 0,
      vote_no: 0,
      vote_abstain: 0,
      result: 'passed',
      raw_text: ''
    });
    setFormErrors({});
    setViewMode('form');
  };

  const handleEdit = (vote) => {
    setEditingVote(vote);
    setFormData({
      session_date: formatDateForInput(vote.session_date),
      proposal_title: vote.proposal_title || '',
      vote_yes: vote.vote_yes || 0,
      vote_no: vote.vote_no || 0,
      vote_abstain: vote.vote_abstain || 0,
      result: vote.result || 'passed',
      raw_text: vote.raw_text || ''
    });
    setFormErrors({});
    setViewMode('form');
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.session_date) {
      errors.session_date = 'Session date is required';
    }
    if (!formData.proposal_title?.trim()) {
      errors.proposal_title = 'Proposal title is required';
    }
    if (formData.vote_yes < 0 || formData.vote_no < 0 || formData.vote_abstain < 0) {
      errors.votes = 'Vote counts cannot be negative';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      let response;
      if (editingVote) {
        response = await api.put(`/api/admin/database/council_votes/${editingVote.id}`, formData);
      } else {
        response = await api.post('/api/admin/database/council_votes', formData);
      }

      if (response.data.success) {
        setSuccessMessage(editingVote ? 'Vote record updated successfully!' : 'Vote record created successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchVotes();
        fetchAvailableYears();
        setViewMode('list');
      } else {
        setFormErrors({ general: response.data.error || 'Failed to save vote record' });
      }
    } catch (err) {
      console.error('Error saving vote:', err);
      setFormErrors({ general: err.response?.data?.message || 'Failed to save vote record' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (voteId) => {
    if (!confirm('Are you sure you want to delete this vote record? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/admin/database/council_votes/${voteId}`);
      if (response.data.success) {
        setSuccessMessage('Vote record deleted successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchVotes();
        fetchAvailableYears();
      } else {
        setError(response.data.error || 'Failed to delete vote record');
      }
    } catch (err) {
      console.error('Error deleting vote:', err);
      setError(err.response?.data?.message || 'Failed to delete vote record');
    }
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingVote(null);
    setFormErrors({});
  };

  const autoCalculateResult = () => {
    const yes = parseInt(formData.vote_yes) || 0;
    const no = parseInt(formData.vote_no) || 0;
    const abstain = parseInt(formData.vote_abstain) || 0;
    const total = yes + no + abstain;
    
    // Simple majority - more than half of present members
    if (total > 0 && yes > no) {
      return 'passed';
    } else if (total > 0 && no >= yes) {
      return 'rejected';
    }
    return 'discussed';
  };

  if (loading && votes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Vote className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Council Votes Management</h1>
                <p className="text-xs text-gray-500">Municipal Council Voting Records Administration</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchVotes}
                className="btn-secondary text-sm"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={handleCreate}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Vote Record
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-700">{successMessage}</span>
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-900">{getStats().total}</div>
            <div className="text-sm text-gray-500">Total Votes</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-2xl font-bold text-green-600">{getStats().passed}</div>
            <div className="text-sm text-gray-500">Passed</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-2xl font-bold text-red-600">{getStats().rejected}</div>
            <div className="text-sm text-gray-500">Rejected</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="text-2xl font-bold text-yellow-600">{getStats().postponed}</div>
            <div className="text-sm text-gray-500">Postponed</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary-500">
            <div className="text-2xl font-bold text-primary-600">{getStats().passRate}%</div>
            <div className="text-sm text-gray-500">Pass Rate</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-green-600">{getStats().totalYes}</div>
                <div className="text-xs text-gray-500">Total YES Votes</div>
              </div>
              <BarChart3 className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-red-600">{getStats().totalNo}</div>
                <div className="text-xs text-gray-500">Total NO Votes</div>
              </div>
              <BarChart3 className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-gray-600">{getStats().totalAbstain}</div>
                <div className="text-xs text-gray-500">Total Abstentions</div>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search proposals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pl-10"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-500" />
                <select
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                  className="form-input w-40"
                >
                  <option value="all">All Results</option>
                  {RESULT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="form-input w-32"
              >
                <option value="all">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-4 pb-4 text-sm text-gray-500">
            Showing {filteredVotes.length} of {votes.length} vote records
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Proposal</th>
                    <th>Yes</th>
                    <th>No</th>
                    <th>Abstain</th>
                    <th>Total</th>
                    <th>Result</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredVotes.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">
                        No vote records found
                      </td>
                    </tr>
                  ) : (
                    filteredVotes.map((vote) => (
                      <tr key={vote.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            {formatDate(vote.session_date)}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium text-gray-900 max-w-xs truncate">
                            {vote.proposal_title}
                          </div>
                          {vote.raw_text && (
                            <div className="text-xs text-gray-500 truncate max-w-xs flex items-center mt-1">
                              <FileText className="h-3 w-3 mr-1" />
                              Has document
                            </div>
                          )}
                        </td>
                        <td className="text-center">
                          <span className="font-semibold text-green-600">{vote.vote_yes || 0}</span>
                        </td>
                        <td className="text-center">
                          <span className="font-semibold text-red-600">{vote.vote_no || 0}</span>
                        </td>
                        <td className="text-center">
                          <span className="font-semibold text-gray-600">{vote.vote_abstain || 0}</span>
                        </td>
                        <td className="text-center">
                          <span className="font-medium">{getTotalVotes(vote)}</span>
                        </td>
                        <td>{getResultBadge(vote.result)}</td>
                        <td>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(vote)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(vote.id)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingVote ? 'Edit Vote Record' : 'Create New Vote Record'}
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Vote Record
                      </>
                    )}
                  </button>
                </div>
              </div>

              {formErrors.general && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-red-700">{formErrors.general}</span>
                </div>
              )}

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-primary-600" />
                    Session Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">
                        Session Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="session_date"
                        value={formData.session_date}
                        onChange={handleInputChange}
                        className={`form-input ${formErrors.session_date ? 'border-red-500' : ''}`}
                      />
                      {formErrors.session_date && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.session_date}</p>
                      )}
                    </div>
                    <div>
                      <label className="form-label">Result</label>
                      <select
                        name="result"
                        value={formData.result}
                        onChange={handleInputChange}
                        className="form-input"
                      >
                        {RESULT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-primary-600" />
                    Proposal Details
                  </h3>
                  <div>
                    <label className="form-label">
                      Proposal Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="proposal_title"
                      value={formData.proposal_title}
                      onChange={handleInputChange}
                      className={`form-input ${formErrors.proposal_title ? 'border-red-500' : ''}`}
                      placeholder="Enter proposal title"
                    />
                    {formErrors.proposal_title && (
                      <p className="mt-1 text-xs text-red-500">{formErrors.proposal_title}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <Vote className="h-5 w-5 mr-2 text-primary-600" />
                    Voting Results
                  </h3>
                  
                  {formErrors.votes && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-600">{formErrors.votes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">YES Votes</label>
                      <input
                        type="number"
                        name="vote_yes"
                        value={formData.vote_yes}
                        onChange={handleInputChange}
                        className="form-input text-center text-lg font-semibold text-green-600"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="form-label">NO Votes</label>
                      <input
                        type="number"
                        name="vote_no"
                        value={formData.vote_no}
                        onChange={handleInputChange}
                        className="form-input text-center text-lg font-semibold text-red-600"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="form-label">Abstentions</label>
                      <input
                        type="number"
                        name="vote_abstain"
                        value={formData.vote_abstain}
                        onChange={handleInputChange}
                        className="form-input text-center text-lg font-semibold text-gray-600"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Vote Summary */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600">Total Participants:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {(parseInt(formData.vote_yes) || 0) + 
                           (parseInt(formData.vote_no) || 0) + 
                           (parseInt(formData.vote_abstain) || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Auto-detected Result:</span>
                        <span className="ml-2 font-semibold">
                          {getResultBadge(autoCalculateResult())}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-primary-600" />
                    Additional Information
                  </h3>
                  <div>
                    <label className="form-label">
                      Raw Document Text <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      name="raw_text"
                      value={formData.raw_text}
                      onChange={handleInputChange}
                      className="form-input font-mono text-sm"
                      rows={6}
                      placeholder="Paste original document text or meeting minutes here..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      This text will be displayed when users expand the vote record details
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Vote Record
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default CouncilVotesPage;

