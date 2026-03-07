/**
 * Database Management Page
 * 
 * Full CRUD interface for all main database tables
 * Enterprise-grade with search, filtering, and audit logging
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Database, Table, Plus, Search, RefreshCw, 
  ChevronLeft, ChevronRight, Edit2, Trash2,
  Eye, X, Save, AlertCircle, CheckCircle,
  LogOut, User, Shield, Settings, ArrowLeft,
  Trash, AlertTriangle
} from 'lucide-react';

const DatabaseManagement = () => {
  const { user, logout, api } = useAuth();
  
  // Table selection state
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableSchema, setTableSchema] = useState(null);
  
  // Data state
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  
  // Filter state
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // view, add, edit
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  // Clear database state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearType, setClearType] = useState(''); // 'table' or 'all'
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // Fetch available tables
  const fetchTables = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/database/tables');
      if (response.data.success) {
        setTables(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  }, [api]);

  // Fetch table schema
  const fetchTableSchema = useCallback(async (tableId) => {
    try {
      const response = await api.get(`/api/admin/database/${tableId}/schema`);
      if (response.data.success) {
        setTableSchema(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch schema:', err);
    }
  }, [api]);

  // Fetch records
  const fetchRecords = useCallback(async (tableId, page = 1) => {
    if (!tableId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (search) params.append('search', search);
      if (yearFilter) params.append('year', yearFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await api.get(`/api/admin/database/${tableId}?${params}`);
      
      if (response.data.success) {
        setRecords(response.data.data.records);
        setPagination(prev => ({
          ...prev,
          ...response.data.data.pagination,
          page
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch records');
    } finally {
      setIsLoading(false);
    }
  }, [api, search, yearFilter, statusFilter, pagination.limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await api.get('/api/admin/database/stats/overview');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [api]);

  // Initial load
  useEffect(() => {
    fetchTables();
    fetchStats();
  }, [fetchTables, fetchStats]);

  // Load records when table changes
  useEffect(() => {
    if (selectedTable) {
      fetchTableSchema(selectedTable);
      fetchRecords(selectedTable, 1);
    }
  }, [selectedTable, fetchTableSchema, fetchRecords]);

  // Handle table selection
  const handleTableSelect = (tableId) => {
    setSelectedTable(tableId);
    setSearch('');
    setYearFilter('');
    setStatusFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecords(selectedTable, 1);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    fetchRecords(selectedTable, newPage);
  };

  // Open modal for viewing
  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setFormData(record);
    setModalMode('view');
    setShowModal(true);
    setSaveError(null);
    setSaveSuccess(false);
  };

  // Open modal for adding
  const handleAddRecord = () => {
    setSelectedRecord(null);
    // Initialize form with defaults
    const defaults = {};
    if (tableSchema?.columns) {
      tableSchema.columns.forEach(col => {
        if (col.default) defaults[col.name] = col.default;
        if (col.type === 'integer') defaults[col.name] = 0;
        if (col.type.includes('decimal')) defaults[col.name] = 0;
      });
    }
    setFormData(defaults);
    setModalMode('add');
    setShowModal(true);
    setSaveError(null);
    setSaveSuccess(false);
  };

  // Open modal for editing
  const handleEditRecord = (record) => {
    setSelectedRecord(record);
    setFormData({ ...record });
    setModalMode('edit');
    setShowModal(true);
    setSaveError(null);
    setSaveSuccess(false);
  };

  // Handle delete
  const handleDeleteRecord = async (record) => {
    if (!window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      // Find the ID column
      const idColumn = tableSchema?.columns?.find(c => c.name === 'id')?.name || 'id';
      const recordId = record[idColumn];
      
      const response = await api.delete(`/api/admin/database/${selectedTable}/${recordId}`);
      
      if (response.data.success) {
        alert('Record deleted successfully');
        fetchRecords(selectedTable, pagination.page);
        fetchStats();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete record');
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    let processedValue = value;
    
    if (type === 'number') {
      processedValue = value === '' ? null : parseFloat(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      let response;
      
      if (modalMode === 'add') {
        response = await api.post(`/api/admin/database/${selectedTable}`, formData);
      } else if (modalMode === 'edit') {
        const idColumn = tableSchema?.columns?.find(c => c.name === 'id')?.name || 'id';
        const recordId = formData[idColumn];
        response = await api.put(`/api/admin/database/${selectedTable}/${recordId}`, formData);
      }

      if (response.data.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          setShowModal(false);
          fetchRecords(selectedTable, pagination.page);
          fetchStats();
        }, 1000);
      }
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save record');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle clear table
  const handleClearTable = async () => {
    if (clearConfirmText !== 'CLEAR_TABLE') {
      alert('Please type CLEAR_TABLE to confirm');
      return;
    }
    
    setIsClearing(true);
    try {
      const response = await api.delete(`/api/admin/database/${selectedTable}/clear`, {
        data: { confirm: 'CLEAR_TABLE' }
      });
      
      if (response.data.success) {
        alert(`Cleared ${response.data.data.deletedCount} records from ${selectedTable}`);
        setShowClearModal(false);
        setClearConfirmText('');
        fetchRecords(selectedTable, 1);
        fetchStats();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to clear table');
    } finally {
      setIsClearing(false);
    }
  };

  // Handle clear all database
  const handleClearAllDatabase = async () => {
    if (clearConfirmText !== 'CLEAR_ALL_DATA') {
      alert('Please type CLEAR_ALL_DATA to confirm');
      return;
    }
    
    setIsClearing(true);
    try {
      const response = await api.post('/api/admin/database/clear', {
        confirm: 'CLEAR_ALL_DATA'
      });
      
      if (response.data.success) {
        alert('Database cleared successfully!');
        setShowClearModal(false);
        setClearConfirmText('');
        fetchStats();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to clear database');
    } finally {
      setIsClearing(false);
    }
  };

  // Open clear modal
  const openClearModal = (type) => {
    setClearType(type);
    setClearConfirmText('');
    setShowClearModal(true);
  };

  // Get status options for filter
  const getStatusOptions = () => {
    if (!tableSchema?.columns) return [];
    const statusCol = tableSchema.columns.find(c => c.name === 'status');
    if (!statusCol) return [];
    
    // Common status values
    return ['planned', 'active', 'completed', 'cancelled', 'parsed', 'error'];
  };

  // Format value for display
  const formatValue = (value, column) => {
    if (value === null || value === undefined) return '-';
    
    if (column.type.includes('decimal') || column.type.includes('numeric')) {
      return typeof value === 'number' ? value.toLocaleString('bg-BG', { minimumFractionDigits: 2 }) : value;
    }
    
    if (column.type.includes('date') || column.type.includes('timestamp')) {
      return new Date(value).toLocaleDateString('bg-BG');
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  };

  // Get table info from stats
  const getTableCount = (tableId) => {
    if (!stats || !stats[tableId]) return 0;
    return stats[tableId].count;
  };

  // Get columns to display in table
  const getDisplayColumns = () => {
    if (!tableSchema?.columns) return [];
    // Show first 6 editable columns
    return tableSchema.columns.slice(0, 6);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button 
                onClick={() => setSelectedTable(null)}
                className="mr-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="bg-primary-600 rounded-lg p-2 mr-3">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {selectedTable ? tableSchema?.displayName || selectedTable : 'Database Management'}
                </h1>
                <p className="text-xs text-gray-500">
                  {selectedTable ? tableSchema?.description || 'Manage records' : 'Select a table to manage'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                <User className="h-4 w-4 mr-2" />
                <span className="font-medium">{user?.username}</span>
                <span className="mx-2 text-gray-400">|</span>
                <span className="text-xs uppercase tracking-wide text-primary-600 font-semibold">
                  {user?.role}
                </span>
              </div>
              
              <button
                onClick={logout}
                className="btn-secondary text-sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedTable ? (
          /* Table Selection View */
          <div className="space-y-6">
            {/* Clear All Database Button */}
            <div className="flex justify-end">
              <button 
                onClick={() => openClearModal('all')}
                className="btn-danger"
              >
                <Trash className="h-4 w-4 mr-2" />
                Clear All Database
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Table className="h-5 w-5 text-primary-600 mr-2" />
                  Available Tables
                </h2>
              </div>
              <div className="card-body">
                {isLoadingStats ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="animate-spin h-6 w-6 text-primary-600" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tables.map((table) => (
                      <div
                        key={table.id}
                        onClick={() => handleTableSelect(table.id)}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{table.displayName}</h3>
                            <p className="text-sm text-gray-500 mt-1">{table.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-primary-600">
                              {getTableCount(table.id)}
                            </span>
                            <p className="text-xs text-gray-500">records</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Table Data View */
          <div className="space-y-6">
            {/* Filters */}
            <div className="card">
              <div className="card-body">
                <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="form-label">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="form-input pl-10"
                        placeholder="Search records..."
                      />
                    </div>
                  </div>
                  
                  {tableSchema?.columns?.some(c => c.name === 'year') && (
                    <div className="w-32">
                      <label className="form-label">Year</label>
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="form-input"
                      >
                        <option value="">All</option>
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                        <option value="2023">2023</option>
                        <option value="2022">2022</option>
                      </select>
                    </div>
                  )}
                  
                  {tableSchema?.columns?.some(c => c.name === 'status') && (
                    <div className="w-40">
                      <label className="form-label">Status</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="form-input"
                      >
                        <option value="">All</option>
                        {getStatusOptions().map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <button type="submit" className="btn-primary">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={() => {
                      setSearch('');
                      setYearFilter('');
                      setStatusFilter('');
                      fetchRecords(selectedTable, 1);
                    }}
                    className="btn-secondary"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                  </button>
                </form>
              </div>
            </div>

            {/* Table Actions */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {records.length} of {pagination.total} records
              </div>
              <div className="flex gap-2">
                <button onClick={() => openClearModal('table')} className="btn-danger">
                  <Trash className="h-4 w-4 mr-2" />
                  Clear Table
                </button>
                <button onClick={handleAddRecord} className="btn-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Record
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="alert-error flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Data Table */}
            <div className="card">
              <div className="card-body p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin h-8 w-8 text-primary-600" />
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No records found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          {getDisplayColumns().map((col) => (
                            <th key={col.name} className="capitalize">
                              {col.name.replace(/_/g, ' ')}
                            </th>
                          ))}
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {records.map((record, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {getDisplayColumns().map((col) => (
                              <td key={col.name} className="truncate max-w-xs">
                                {formatValue(record[col.name], col)}
                              </td>
                            ))}
                            <td>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleViewRecord(record)}
                                  className="p-1 text-gray-500 hover:text-primary-600"
                                  title="View"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleEditRecord(record)}
                                  className="p-1 text-gray-500 hover:text-primary-600"
                                  title="Edit"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(record)}
                                  className="p-1 text-gray-500 hover:text-danger-600"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalMode === 'view' ? 'View Record' : modalMode === 'add' ? 'Add New Record' : 'Edit Record'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {saveError && (
                <div className="alert-error flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="alert-success flex items-start">
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Record saved successfully!</span>
                </div>
              )}

              {tableSchema?.columns?.map((column) => {
                if (!column.editable && modalMode === 'edit') return null;
                if (column.name === 'id' || column.name === 'created_at' || column.name === 'updated_at') {
                  return modalMode !== 'add' ? null : null;
                }

                const isEditable = column.editable || modalMode === 'add';
                
                return (
                  <div key={column.name}>
                    <label className="form-label capitalize">
                      {column.name.replace(/_/g, ' ')}
                      {column.required && <span className="text-danger-600 ml-1">*</span>}
                    </label>
                    {column.type.includes('text') || column.name === 'description' || column.name === 'raw_text' ? (
                      <textarea
                        name={column.name}
                        value={formData[column.name] || ''}
                        onChange={handleInputChange}
                        disabled={modalMode === 'view' || !isEditable}
                        className="form-input"
                        rows={3}
                      />
                    ) : column.type.includes('boolean') ? (
                      <input
                        type="checkbox"
                        name={column.name}
                        checked={formData[column.name] || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, [column.name]: e.target.checked }))}
                        disabled={modalMode === 'view' || !isEditable}
                        className="h-4 w-4 text-primary-600"
                      />
                    ) : column.name === 'status' ? (
                      <select
                        name={column.name}
                        value={formData[column.name] || ''}
                        onChange={handleInputChange}
                        disabled={modalMode === 'view' || !isEditable}
                        className="form-input"
                      >
                        <option value="">Select status</option>
                        {getStatusOptions().map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    ) : column.type.includes('date') ? (
                      <input
                        type="date"
                        name={column.name}
                        value={formData[column.name] ? formData[column.name].split('T')[0] : ''}
                        onChange={handleInputChange}
                        disabled={modalMode === 'view' || !isEditable}
                        className="form-input"
                      />
                    ) : (
                      <input
                        type={column.type.includes('int') || column.type.includes('decimal') ? 'number' : 'text'}
                        name={column.name}
                        value={formData[column.name] ?? ''}
                        onChange={handleInputChange}
                        disabled={modalMode === 'view' || !isEditable}
                        className="form-input"
                        step={column.type.includes('decimal') ? '0.01' : undefined}
                      />
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Type: {column.type}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            {modalMode !== 'view' && (
              <div className="flex justify-end space-x-3 p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="btn-primary"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Record
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-danger-100 rounded-full p-3">
                  <AlertTriangle className="h-8 w-8 text-danger-600" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                {clearType === 'all' ? 'Clear All Database?' : 'Clear Table Data?'}
              </h3>
              
              <p className="text-sm text-gray-600 text-center mb-4">
                {clearType === 'all' 
                  ? 'This will permanently delete ALL data from ALL tables. This action cannot be undone!'
                  : `This will permanently delete ALL data from ${selectedTable}. This action cannot be undone!`
                }
              </p>
              
              <div className="mb-4">
                <label className="form-label text-center block mb-2">
                  Type <span className="font-mono font-bold">{clearType === 'all' ? 'CLEAR_ALL_DATA' : 'CLEAR_TABLE'}</span> to confirm
                </label>
                <input
                  type="text"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  className="form-input text-center"
                  placeholder="Enter confirmation text..."
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="btn-secondary flex-1"
                  disabled={isClearing}
                >
                  Cancel
                </button>
                <button
                  onClick={clearType === 'all' ? handleClearAllDatabase : handleClearTable}
                  disabled={isClearing || (clearType === 'all' ? clearConfirmText !== 'CLEAR_ALL_DATA' : clearConfirmText !== 'CLEAR_TABLE')}
                  className="btn-danger flex-1"
                >
                  {isClearing ? (
                    <>
                      <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4 inline" />
                      Clearing...
                    </>
                  ) : (
                    'Confirm Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManagement;
