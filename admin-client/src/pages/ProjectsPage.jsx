/**
 * Projects Management Page
 * 
 * Enterprise-grade project management interface for municipal projects
 * Includes interactive map, status management, and comprehensive project details
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  MapPin, Plus, Search, Filter, Edit2, Trash2, 
  Eye, EyeOff, Loader2,
  Building, DollarSign, Calendar, CheckCircle,
  AlertCircle, X, Save, RefreshCw, Map,
  ExternalLink, Clock, Flag, FileText
} from 'lucide-react';

// Status options with colors
const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'active', label: 'Active', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-gray-100 text-gray-800 border-gray-300' }
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-600' }
];

// Budget categories
const BUDGET_CATEGORIES = [
  'Infrastructure',
  'Education',
  'Healthcare',
  'Environment',
  'Culture',
  'Public Safety',
  'Transportation',
  'Housing',
  'Sports',
  'Administration',
  'Other'
];

// Project types
const PROJECT_TYPES = [
  'Construction',
  'Renovation',
  'Maintenance',
  'Planning',
  'Research',
  'Equipment',
  'Services',
  'Other'
];

// Funding sources
const FUNDING_SOURCES = [
  'Municipal Budget',
  'State Budget',
  'EU Funds',
  'Government Grant',
  'Private Investment',
  'Public-Private Partnership',
  'Donation',
  'Loan',
  'Other'
];

const ProjectsPage = () => {
  const { user, api } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // View mode
  const [viewMode, setViewMode] = useState('list');
  const [editingProject, setEditingProject] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    project_code: '',
    title: '',
    description: '',
    detailed_description: '',
    status: 'planned',
    priority: 'normal',
    budget: '',
    budget_spent: '',
    funding_source: '',
    budget_category: '',
    contractor: '',
    contractor_contact: '',
    contract_number: '',
    contract_value: '',
    address: '',
    lat: '',
    lng: '',
    municipality: 'Stara Zagora',
    settlement: '',
    start_date: '',
    end_date: '',
    actual_start_date: '',
    actual_end_date: '',
    duration_days: '',
    project_type: '',
    category: '',
    notes: '',
    public_visible: true,
    citizen_votes_enabled: true,
    created_by: user?.username || '',
    approved_by: '',
    approval_date: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/admin/database/projects');
      if (response.data.success) {
        setProjects(response.data.data.records || []);
      } else {
        setError(response.data.error || 'Failed to fetch projects');
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err.response?.data?.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || project.budget_category === categoryFilter;
    const matchesSearch = !searchQuery || 
      project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.contractor?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const getStats = () => {
    return {
      total: projects.length,
      planned: projects.filter(p => p.status === 'planned').length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      cancelled: projects.filter(p => p.status === 'cancelled').length,
      totalBudget: projects.reduce((sum, p) => sum + (parseFloat(p.budget) || 0), 0)
    };
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: 'BGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    if (!option) return <span className="badge">{status}</span>;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${option.color}`}>
        {option.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const option = PRIORITY_OPTIONS.find(o => o.value === priority);
    if (!option) return null;
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${option.color}`}>
        {option.label}
      </span>
    );
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleCreate = () => {
    setEditingProject(null);
    setFormData({
      project_code: generateProjectCode(),
      title: '',
      description: '',
      detailed_description: '',
      status: 'planned',
      priority: 'normal',
      budget: '',
      budget_spent: '',
      funding_source: '',
      budget_category: '',
      contractor: '',
      contractor_contact: '',
      contract_number: '',
      contract_value: '',
      address: '',
      lat: '',
      lng: '',
      municipality: 'Stara Zagora',
      settlement: '',
      start_date: '',
      end_date: '',
      actual_start_date: '',
      actual_end_date: '',
      duration_days: '',
      project_type: '',
      category: '',
      notes: '',
      public_visible: true,
      citizen_votes_enabled: true,
      created_by: user?.username || '',
      approved_by: '',
      approval_date: ''
    });
    setFormErrors({});
    setViewMode('form');
  };

  const generateProjectCode = () => {
    const year = new Date().getFullYear();
    const count = projects.length + 1;
    return `PRJ-${year}-${count.toString().padStart(3, '0')}`;
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      project_code: project.project_code || '',
      title: project.title || '',
      description: project.description || '',
      detailed_description: project.detailed_description || '',
      status: project.status || 'planned',
      priority: project.priority || 'normal',
      budget: project.budget || '',
      budget_spent: project.budget_spent || '',
      funding_source: project.funding_source || '',
      budget_category: project.budget_category || '',
      contractor: project.contractor || '',
      contractor_contact: project.contractor_contact || '',
      contract_number: project.contract_number || '',
      contract_value: project.contract_value || '',
      address: project.address || '',
      lat: project.lat || '',
      lng: project.lng || '',
      municipality: project.municipality || 'Stara Zagora',
      settlement: project.settlement || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      actual_start_date: project.actual_start_date || '',
      actual_end_date: project.actual_end_date || '',
      duration_days: project.duration_days || '',
      project_type: project.project_type || '',
      category: project.category || '',
      notes: project.notes || '',
      public_visible: project.public_visible !== false,
      citizen_votes_enabled: project.citizen_votes_enabled !== false,
      created_by: project.created_by || user?.username || '',
      approved_by: project.approved_by || '',
      approval_date: project.approval_date || ''
    });
    setFormErrors({});
    setViewMode('form');
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    if (formData.lat && (isNaN(parseFloat(formData.lat)) || parseFloat(formData.lat) < -90 || parseFloat(formData.lat) > 90)) {
      errors.lat = 'Invalid latitude';
    }
    if (formData.lng && (isNaN(parseFloat(formData.lng)) || parseFloat(formData.lng) < -180 || parseFloat(formData.lng) > 180)) {
      errors.lng = 'Invalid longitude';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        budget_spent: formData.budget_spent ? parseFloat(formData.budget_spent) : null,
        contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        duration_days: formData.duration_days ? parseInt(formData.duration_days) : null
      };

      let response;
      if (editingProject) {
        response = await api.put(`/api/admin/database/projects/${editingProject.id}`, submitData);
      } else {
        response = await api.post('/api/admin/database/projects', submitData);
      }

      if (response.data.success) {
        setSuccessMessage(editingProject ? 'Project updated successfully!' : 'Project created successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchProjects();
        setViewMode('list');
      } else {
        setFormErrors({ general: response.data.error || 'Failed to save project' });
      }
    } catch (err) {
      console.error('Error saving project:', err);
      setFormErrors({ general: err.response?.data?.message || 'Failed to save project' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/api/admin/database/projects/${projectId}`);
      if (response.data.success) {
        setSuccessMessage('Project deleted successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchProjects();
      } else {
        setError(response.data.error || 'Failed to delete project');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleToggleVisibility = async (project) => {
    try {
      const response = await api.put(`/api/admin/database/projects/${project.id}`, {
        public_visible: !project.public_visible
      });
      if (response.data.success) {
        fetchProjects();
      }
    } catch (err) {
      console.error('Error toggling visibility:', err);
    }
  };

  const openCoordinatePicker = () => {
    const lat = formData.lat || '42.4257';
    const lng = formData.lng || '25.6344';
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlng=${lng}#map=15/${lat}/${lng}`, '_blank');
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingProject(null);
    setFormErrors({});
  };

  if (loading && projects.length === 0) {
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
              <MapPin className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Project Management</h1>
                <p className="text-xs text-gray-500">Municipal Projects Map Administration</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchProjects}
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
                New Project
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
            <div className="text-sm text-gray-500">Total Projects</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
            <div className="text-2xl font-bold text-amber-600">{getStats().planned}</div>
            <div className="text-sm text-gray-500">Planned</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-2xl font-bold text-blue-600">{getStats().active}</div>
            <div className="text-sm text-gray-500">Active</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-2xl font-bold text-green-600">{getStats().completed}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(getStats().totalBudget)}</div>
            <div className="text-sm text-gray-500">Total Budget</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pl-10"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-input w-40"
                >
                  <option value="all">All Status</option>
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="form-input w-48"
              >
                <option value="all">All Categories</option>
                {BUDGET_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-4 pb-4 text-sm text-gray-500">
            Showing {filteredProjects.length} of {projects.length} projects
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Budget</th>
                    <th>Location</th>
                    <th>Timeline</th>
                    <th>Visible</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-gray-500">
                        No projects found
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => (
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="font-mono text-sm">{project.project_code || '-'}</td>
                        <td>
                          <div className="font-medium text-gray-900 max-w-xs truncate">
                            {project.title}
                          </div>
                          {project.contractor && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {project.contractor}
                            </div>
                          )}
                        </td>
                        <td>{getStatusBadge(project.status)}</td>
                        <td>{getPriorityBadge(project.priority)}</td>
                        <td className="text-right">
                          {project.budget ? (
                            <span className="font-medium">{formatCurrency(project.budget)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td>
                          {project.lat && project.lng ? (
                            <div className="flex items-center text-sm text-primary-600">
                              <MapPin className="h-3 w-3 mr-1" />
                              {project.settlement || project.municipality || 'Map'}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="text-sm">
                          {project.start_date && project.end_date ? (
                            <div>
                              <div className="text-gray-900">{formatDate(project.start_date)}</div>
                              <div className="text-gray-500">to {formatDate(project.end_date)}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleVisibility(project)}
                            className={`p-1 rounded ${project.public_visible ? 'text-green-600' : 'text-gray-400'}`}
                            title={project.public_visible ? 'Visible to public' : 'Hidden from public'}
                          >
                            {project.public_visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEdit(project)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(project.id)}
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
                  {editingProject ? 'Edit Project' : 'Create New Project'}
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
                        Save Project
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

              <div className="p-6 space-y-8">
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-primary-600" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Project Code</label>
                      <input
                        type="text"
                        name="project_code"
                        value={formData.project_code}
                        onChange={handleInputChange}
                        className="form-input font-mono"
                        placeholder="PRJ-2025-001"
                      />
                    </div>
                    <div>
                      <label className="form-label">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className={`form-input ${formErrors.title ? 'border-red-500' : ''}`}
                        placeholder="Project title"
                      />
                      {formErrors.title && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.title}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="form-label">Description</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="form-input"
                        rows={2}
                        placeholder="Brief project description"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="form-label">Detailed Description</label>
                      <textarea
                        name="detailed_description"
                        value={formData.detailed_description}
                        onChange={handleInputChange}
                        className="form-input"
                        rows={4}
                        placeholder="Full project details"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <Flag className="h-5 w-5 mr-2 text-primary-600" />
                    Status &amp; Priority
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Status</label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="form-input"
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Priority</label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleInputChange}
                        className="form-input"
                      >
                        {PRIORITY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-primary-600" />
                    Budget Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Budget (BGN)</label>
                      <input
                        type="number"
                        name="budget"
                        value={formData.budget}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="form-label">Budget Spent (BGN)</label>
                      <input
                        type="number"
                        name="budget_spent"
                        value={formData.budget_spent}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="form-label">Funding Source</label>
                      <select
                        name="funding_source"
                        value={formData.funding_source}
                        onChange={handleInputChange}
                        className="form-input"
                      >
                        <option value="">Select funding source</option>
                        {FUNDING_SOURCES.map(source => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Budget Category</label>
                      <select
                        name="budget_category"
                        value={formData.budget_category}
                        onChange={handleInputChange}
                        className="form-input"
                      >
                        <option value="">Select category</option>
                        {BUDGET_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <Building className="h-5 w-5 mr-2 text-primary-600" />
                    Contractor Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Contractor</label>
                      <input
                        type="text"
                        name="contractor"
                        value={formData.contractor}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Contractor name"
                      />
                    </div>
                    <div>
                      <label className="form-label">Contract Number</label>
                      <input
                        type="text"
                        name="contract_number"
                        value={formData.contract_number}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Contract number"
                      />
                    </div>
                    <div>
                      <label className="form-label">Contract Value (BGN)</label>
                      <input
                        type="number"
                        name="contract_value"
                        value={formData.contract_value}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="form-label">Contact Information</label>
                      <textarea
                        name="contractor_contact"
                        value={formData.contractor_contact}
                        onChange={handleInputChange}
                        className="form-input"
                        rows={2}
                        placeholder="Contact details"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-primary-600" />
                    Location
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="form-label">Address</label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Full address"
                      />
                    </div>
                    <div>
                      <label className="form-label">Latitude</label>
                      <input
                        type="text"
                        name="lat"
                        value={formData.lat}
                        onChange={handleInputChange}
                        className={`form-input font-mono ${formErrors.lat ? 'border-red-500' : ''}`}
                        placeholder="42.4257"
                      />
                      {formErrors.lat && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.lat}</p>
                      )}
                    </div>
                    <div>
                      <label className="form-label">Longitude</label>
                      <input
                        type="text"
                        name="lng"
                        value={formData.lng}
                        onChange={handleInputChange}
                        className={`form-input font-mono ${formErrors.lng ? 'border-red-500' : ''}`}
                        placeholder="25.6344"
                      />
                      {formErrors.lng && (
                        <p className="mt-1 text-xs text-red-500">{formErrors.lng}</p>
                      )}
                    </div>
                    <div>
                      <label className="form-label">Municipality</label>
                      <input
                        type="text"
                        name="municipality"
                        value={formData.municipality}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Stara Zagora"
                      />
                    </div>
                    <div>
                      <label className="form-label">Settlement/Village</label>
                      <input
                        type="text"
                        name="settlement"
                        value={formData.settlement}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Town or village name"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={openCoordinatePicker}
                        className="btn-secondary text-sm"
                      >
                        <Map className="h-4 w-4 mr-2" />
                        Pick Coordinates on Map
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </button>
                      <p className="mt-2 text-xs text-gray-500">
                        Click above to open OpenStreetMap in a new tab. Right-click on the location and copy the coordinates.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-primary-600" />
                    Timeline
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Planned Start Date</label>
                      <input
                        type="date"
                        name="start_date"
                        value={formData.start_date}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Planned End Date</label>
                      <input
                        type="date"
                        name="end_date"
                        value={formData.end_date}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Actual Start Date</label>
                      <input
                        type="date"
                        name="actual_start_date"
                        value={formData.actual_start_date}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Actual End Date</label>
                      <input
                        type="date"
                        name="actual_end_date"
                        value={formData.actual_end_date}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Duration (Days)</label>
                      <input
                        type="number"
                        name="duration_days"
                        value={formData.duration_days}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="form-label">Project Type</label>
                      <select
                        name="project_type"
                        value={formData.project_type}
                        onChange={handleInputChange}
                        className="form-input"
                      >
                        <option value="">Select type</option>
                        {PROJECT_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-primary-600" />
                    Additional Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Notes</label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        className="form-input"
                        rows={3}
                        placeholder="Internal notes about the project"
                      />
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="public_visible"
                          checked={formData.public_visible}
                          onChange={handleInputChange}
                          className="form-checkbox mr-2"
                        />
                        <span className="text-sm text-gray-700">Visible to public</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="citizen_votes_enabled"
                          checked={formData.citizen_votes_enabled}
                          onChange={handleInputChange}
                          className="form-checkbox mr-2"
                        />
                        <span className="text-sm text-gray-700">Enable citizen voting</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="form-label">Created By</label>
                        <input
                          type="text"
                          name="created_by"
                          value={formData.created_by}
                          onChange={handleInputChange}
                          className="form-input"
                          placeholder="Username"
                        />
                      </div>
                      <div>
                        <label className="form-label">Approved By</label>
                        <input
                          type="text"
                          name="approved_by"
                          value={formData.approved_by}
                          onChange={handleInputChange}
                          className="form-input"
                          placeholder="Approver name"
                        />
                      </div>
                      <div>
                        <label className="form-label">Approval Date</label>
                        <input
                          type="date"
                          name="approval_date"
                          value={formData.approval_date}
                          onChange={handleInputChange}
                          className="form-input"
                        />
                      </div>
                    </div>
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
                      Save Project
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

export default ProjectsPage;
