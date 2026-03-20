import React, { useState, useEffect, useCallback } from 'react';
import logo from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Database, Table, Plus, Search, RefreshCw,
  ChevronLeft, ChevronRight, Edit2, Trash2,
  Eye, X, Save, AlertCircle, CheckCircle,
  LogOut, User, Shield, MapPin, Vote,
  LayoutDashboard, Menu, Trash, AlertTriangle
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Database',      icon: Database,        path: '/database' },
  { label: 'Projects',      icon: MapPin,          path: '/projects' },
  { label: 'Council Votes', icon: Vote,            path: '/council-votes' },
];

const DatabaseManagement = () => {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableSchema, setTableSchema] = useState(null);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearType, setClearType] = useState('');
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const fetchTables = useCallback(async () => {
    try {
      const r = await api.get('/admin/database/tables');
      if (r.data.success) setTables(r.data.data);
    } catch {}
  }, [api]);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const r = await api.get('/admin/database/stats/overview');
      if (r.data.success) setStats(r.data.data);
    } catch {}
    finally { setIsLoadingStats(false); }
  }, [api]);

  const fetchRecords = useCallback(async (tableId, page = 1) => {
    if (!tableId) return;
    setIsLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: pagination.limit.toString() });
      if (search) params.append('search', search);
      if (yearFilter) params.append('year', yearFilter);
      if (statusFilter) params.append('status', statusFilter);
      const r = await api.get(`/admin/database/${tableId}?${params}`);
      if (r.data.success) {
        setRecords(r.data.data.records);
        setPagination(p => ({ ...p, ...r.data.data.pagination, page }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch records');
    } finally { setIsLoading(false); }
  }, [api, search, yearFilter, statusFilter, pagination.limit]);

  const fetchSchema = useCallback(async (tableId) => {
    try {
      const r = await api.get(`/admin/database/${tableId}/schema`);
      if (r.data.success) setTableSchema(r.data.data);
    } catch {}
  }, [api]);

  useEffect(() => { fetchTables(); fetchStats(); }, [fetchTables, fetchStats]);
  useEffect(() => { if (selectedTable) { fetchSchema(selectedTable); fetchRecords(selectedTable, 1); } }, [selectedTable]);

  const handleTableSelect = (id) => {
    setSelectedTable(id); setSearch(''); setYearFilter(''); setStatusFilter('');
    setPagination(p => ({ ...p, page: 1 }));
  };

  const openModal = (mode, record = null) => {
    setModalMode(mode);
    setFormData(record ? { ...record } : {});
    setSaveError(null); setSaveSuccess(false);
    setShowModal(true);
  };

  const handleDelete = async (record) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/database/${selectedTable}/${record.id}`);
      fetchRecords(selectedTable, pagination.page);
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleSave = async () => {
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      let r;
      if (modalMode === 'add') {
        r = await api.post(`/admin/database/${selectedTable}`, formData);
      } else {
        r = await api.put(`/admin/database/${selectedTable}/${formData.id}`, formData);
      }
      if (r.data.success) {
        setSaveSuccess(true);
        setTimeout(() => { setShowModal(false); fetchRecords(selectedTable, pagination.page); fetchStats(); }, 800);
      }
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save');
    } finally { setIsSaving(false); }
  };

  const handleClear = async () => {
    const expected = clearType === 'all' ? 'CLEAR_ALL_DATA' : 'CLEAR_TABLE';
    if (clearConfirmText !== expected) { alert(`Type ${expected} to confirm`); return; }
    setIsClearing(true);
    try {
      if (clearType === 'all') {
        await api.post('/admin/database/clear', { confirm: 'CLEAR_ALL_DATA' });
      } else {
        await api.delete(`/admin/database/${selectedTable}/clear`, { data: { confirm: 'CLEAR_TABLE' } });
        fetchRecords(selectedTable, 1);
      }
      setShowClearModal(false); setClearConfirmText(''); fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to clear');
    } finally { setIsClearing(false); }
  };

  const getDisplayColumns = () => tableSchema?.columns?.slice(0, 5) || [];
  const getStatusOptions = () => ['planned','active','completed','cancelled','parsed','error'];
  const getTableCount = (id) => stats?.[id]?.count || 0;

  const formatValue = (value, col) => {
    if (value === null || value === undefined) return '—';
    if (col.type.includes('decimal') || col.type.includes('numeric')) return typeof value === 'number' ? value.toLocaleString('bg-BG', { minimumFractionDigits: 2 }) : value;
    if (col.type.includes('date') || col.type.includes('timestamp')) return new Date(value).toLocaleDateString('bg-BG');
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 60) + '...';
    const str = String(value);
    return str.length > 60 ? str.slice(0, 60) + '…' : str;
  };

  const Sidebar = () => (
    <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static top-0 left-0 h-full md:h-auto w-56 bg-white border-r border-gray-200 flex flex-col py-4 gap-1 shrink-0 z-20 transition-transform duration-200 pt-16 md:pt-4`}>
      {NAV.map(({ label, icon: Icon, path }) => (
        <button key={path} onClick={() => { navigate(path); setSidebarOpen(false); }}
          className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${location.pathname === path ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
          <Icon className="h-4 w-4 shrink-0" />{label}
        </button>
      ))}
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm z-20">
        <div className="flex items-center justify-between h-14 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setSidebarOpen(o => !o)}><Menu className="h-5 w-5" /></button>
            <img src={logo} alt="Open Zagora" className="h-8 w-8" />
            <span className="font-bold text-gray-900">Open Zagora <span className="text-gray-400 font-normal hidden sm:inline">Admin</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
              <User className="h-4 w-4" /><span className="font-medium">{user?.username}</span>
            </div>
            <button onClick={logout} className="btn-secondary text-sm flex items-center gap-2">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-10 md:hidden" onClick={() => setSidebarOpen(false)} />}
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedTable && (
                  <button onClick={() => setSelectedTable(null)} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{selectedTable ? tableSchema?.displayName || selectedTable : 'Database Management'}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedTable ? tableSchema?.description || 'Manage records' : 'Select a table to manage'}</p>
                </div>
              </div>
              {!selectedTable && (
                <button onClick={() => { setClearType('all'); setClearConfirmText(''); setShowClearModal(true); }} className="btn-danger text-sm flex items-center gap-2">
                  <Trash className="h-4 w-4" /><span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </div>

            {!selectedTable ? (
              /* Table grid */
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <Table className="h-4 w-4 text-primary-600" />
                  <h2 className="font-semibold text-gray-900">Available Tables</h2>
                </div>
                <div className="card-body">
                  {isLoadingStats ? (
                    <div className="flex justify-center py-8"><RefreshCw className="animate-spin h-6 w-6 text-primary-600" /></div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tables.map(t => (
                        <button key={t.id} onClick={() => handleTableSelect(t.id)}
                          className="text-left border border-gray-200 rounded-lg p-4 hover:border-primary-500 hover:shadow-md transition-all">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate">{t.displayName}</h3>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{t.description}</p>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <span className="text-2xl font-bold text-primary-600">{getTableCount(t.id)}</span>
                              <p className="text-xs text-gray-500">records</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Table data view */
              <>
                {/* Filters */}
                <div className="card p-3 sm:p-4">
                  <form onSubmit={e => { e.preventDefault(); fetchRecords(selectedTable, 1); }} className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9 text-sm" placeholder="Search records..." />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {tableSchema?.columns?.some(c => c.name === 'year') && (
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="form-input text-sm py-1.5 w-24">
                          <option value="">All Years</option>
                          {['2025','2024','2023','2022'].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      )}
                      {tableSchema?.columns?.some(c => c.name === 'status') && (
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-input text-sm py-1.5 w-32">
                          <option value="">All Status</option>
                          {getStatusOptions().map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      <button type="submit" className="btn-primary text-sm px-3">Search</button>
                      <button type="button" onClick={() => { setSearch(''); setYearFilter(''); setStatusFilter(''); fetchRecords(selectedTable, 1); }} className="btn-secondary text-sm px-3">Reset</button>
                    </div>
                  </form>
                </div>

                {/* Actions bar */}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">{records.length} of {pagination.total} records</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setClearType('table'); setClearConfirmText(''); setShowClearModal(true); }} className="btn-danger text-sm flex items-center gap-1.5">
                      <Trash className="h-4 w-4" /><span className="hidden sm:inline">Clear Table</span>
                    </button>
                    <button onClick={() => openModal('add')} className="btn-primary text-sm flex items-center gap-1.5">
                      <Plus className="h-4 w-4" /><span className="hidden sm:inline">Add Record</span>
                    </button>
                  </div>
                </div>

                {error && <div className="alert-error flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

                <div className="card overflow-hidden">
                  {isLoading ? (
                    <div className="flex justify-center py-12"><RefreshCw className="animate-spin h-8 w-8 text-primary-600" /></div>
                  ) : records.length === 0 ? (
                    <p className="text-center py-12 text-gray-500 text-sm">No records found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            {getDisplayColumns().map(col => <th key={col.name} className="capitalize">{col.name.replace(/_/g,' ')}</th>)}
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {records.map((record, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {getDisplayColumns().map(col => (
                                <td key={col.name} className="truncate max-w-[160px] text-sm">{formatValue(record[col.name], col)}</td>
                              ))}
                              <td>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => openModal('view', record)} className="p-1 text-gray-500 hover:text-primary-600" title="View"><Eye className="h-4 w-4" /></button>
                                  <button onClick={() => openModal('edit', record)} className="p-1 text-gray-500 hover:text-primary-600" title="Edit"><Edit2 className="h-4 w-4" /></button>
                                  <button onClick={() => handleDelete(record)} className="p-1 text-gray-500 hover:text-danger-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => fetchRecords(selectedTable, pagination.page - 1)} disabled={pagination.page === 1} className="btn-secondary disabled:opacity-50 p-2"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.totalPages}</span>
                    <button onClick={() => fetchRecords(selectedTable, pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="btn-secondary disabled:opacity-50 p-2"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="font-semibold text-gray-900">
                {modalMode === 'view' ? 'View Record' : modalMode === 'add' ? 'Add Record' : 'Edit Record'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              {saveError && <div className="alert-error flex items-center gap-2 text-sm"><AlertCircle className="h-4 w-4 shrink-0" />{saveError}</div>}
              {saveSuccess && <div className="alert-success flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 shrink-0" />Saved successfully!</div>}

              {tableSchema?.columns?.filter(col => col.editable || modalMode === 'view').map(col => {
                if (['id','created_at','updated_at'].includes(col.name)) return null;
                const disabled = modalMode === 'view';
                const val = formData[col.name] ?? '';
                return (
                  <div key={col.name}>
                    <label className="form-label capitalize">{col.name.replace(/_/g,' ')}{col.required && <span className="text-red-500 ml-1">*</span>}</label>
                    {col.type.includes('text') || col.name.includes('description') || col.name.includes('raw') ? (
                      <textarea name={col.name} value={val} onChange={e => setFormData(p => ({...p,[col.name]:e.target.value}))} disabled={disabled} className="form-input text-sm" rows={3} />
                    ) : col.type.includes('bool') ? (
                      <input type="checkbox" checked={!!val} onChange={e => setFormData(p => ({...p,[col.name]:e.target.checked}))} disabled={disabled} className="h-4 w-4 text-primary-600" />
                    ) : col.name === 'status' ? (
                      <select name={col.name} value={val} onChange={e => setFormData(p => ({...p,[col.name]:e.target.value}))} disabled={disabled} className="form-input text-sm">
                        <option value="">Select</option>
                        {getStatusOptions().map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : col.type.includes('date') ? (
                      <input type="date" name={col.name} value={val ? String(val).split('T')[0] : ''} onChange={e => setFormData(p => ({...p,[col.name]:e.target.value}))} disabled={disabled} className="form-input text-sm" />
                    ) : (
                      <input type={col.type.includes('int') || col.type.includes('decimal') ? 'number' : 'text'} name={col.name} value={val} onChange={e => setFormData(p => ({...p,[col.name]:e.target.value}))} disabled={disabled} className="form-input text-sm" step={col.type.includes('decimal') ? '0.01' : undefined} />
                    )}
                  </div>
                );
              })}
            </div>
            {modalMode !== 'view' && (
              <div className="flex justify-end gap-3 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
                <button onClick={() => setShowModal(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="btn-primary text-sm">
                  {isSaving ? <><RefreshCw className="animate-spin h-4 w-4 mr-1" />Saving...</> : <><Save className="h-4 w-4 mr-1" />Save</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 rounded-full p-3"><AlertTriangle className="h-8 w-8 text-red-600" /></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              {clearType === 'all' ? 'Clear All Database?' : `Clear ${selectedTable}?`}
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              {clearType === 'all' ? 'This will permanently delete ALL data from ALL tables.' : `This will permanently delete ALL records from ${selectedTable}.`} This cannot be undone.
            </p>
            <div className="mb-4">
              <label className="form-label text-center block mb-1">
                Type <span className="font-mono font-bold">{clearType === 'all' ? 'CLEAR_ALL_DATA' : 'CLEAR_TABLE'}</span> to confirm
              </label>
              <input type="text" value={clearConfirmText} onChange={e => setClearConfirmText(e.target.value)} className="form-input text-center text-sm" placeholder="Type confirmation..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowClearModal(false)} className="btn-secondary flex-1 text-sm" disabled={isClearing}>Cancel</button>
              <button onClick={handleClear} disabled={isClearing || clearConfirmText !== (clearType === 'all' ? 'CLEAR_ALL_DATA' : 'CLEAR_TABLE')} className="btn-danger flex-1 text-sm">
                {isClearing ? <><RefreshCw className="animate-spin h-4 w-4 mr-1 inline" />Clearing...</> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManagement;
