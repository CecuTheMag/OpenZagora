import React, { useState, useEffect } from 'react';
import logo from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin, Search, Filter, Edit2, Trash2,
  Loader2, DollarSign, Calendar, CheckCircle,
  AlertCircle, X, Save, RefreshCw, ExternalLink,
  Shield, LogOut, User, Database, Vote,
  LayoutDashboard, Map, Menu, FileText, ChevronLeft
} from 'lucide-react';


const NAV = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Database',      icon: Database,        path: '/database' },
  { label: 'Projects',      icon: MapPin,          path: '/projects' },
  { label: 'Council Votes', icon: Vote,            path: '/council-votes' },
];

const STATUS_COLORS = {
  planned:   'bg-amber-100 text-amber-800 border-amber-300',
  active:    'bg-primary-100 text-primary-800 border-primary-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_OPTIONS = ['planned', 'active', 'completed', 'cancelled'];

const EMPTY_FORM = {
  title: '', description: '', status: 'active',
  budget: '', contractor: '', address: '',
  lat: '', lng: '', publication_date: '', end_date: '', source_url: ''
};

const ProjectsPage = () => {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'form'
  const [editingTender, setEditingTender] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchTenders(); }, []);

  const fetchTenders = async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get('/admin/database/eop_data?limit=500');
      setTenders(r.data?.data?.records || []);
    } catch (err) {
      setError('Failed to load EOP tenders');
    } finally { setLoading(false); }
  };

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const filtered = tenders.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.contractor?.toLowerCase().includes(q) || t.address?.toLowerCase().includes(q) || t.eop_id?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const stats = {
    total: tenders.length,
    active: tenders.filter(t => t.status === 'active').length,
    completed: tenders.filter(t => t.status === 'completed').length,
    totalBudget: tenders.reduce((s, t) => s + (parseFloat(t.budget) || 0), 0),
  };

  const formatCurrency = (v) => v ? new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'BGN', maximumFractionDigits: 0 }).format(v) : '—';
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('bg-BG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const handleEdit = (tender) => {
    setEditingTender(tender);
    setFormData({
      title: tender.title || '',
      description: tender.description || '',
      status: tender.status || 'active',
      budget: tender.budget || '',
      contractor: tender.contractor || '',
      address: tender.address || '',
      lat: tender.lat || '',
      lng: tender.lng || '',
      publication_date: tender.publication_date?.slice(0, 10) || '',
      end_date: tender.end_date?.slice(0, 10) || '',
      source_url: tender.source_url || '',
    });
    setFormErrors({});
    setViewMode('form');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this tender? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/database/eop_data/${id}`);
      showSuccess('Tender deleted');
      fetchTenders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete tender');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { setFormErrors({ title: 'Title is required' }); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
      };
      await api.put(`/admin/database/eop_data/${editingTender.id}`, payload);
      showSuccess('Tender updated successfully');
      fetchTenders();
      setViewMode('list');
    } catch (err) {
      setFormErrors({ general: err.response?.data?.message || 'Failed to save' });
    } finally { setIsSubmitting(false); }
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm z-20">
        <div className="flex items-center justify-between h-14 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setSidebarOpen(o => !o)}>
              <Menu className="h-5 w-5" />
            </button>
            <img src={logo} alt="Open Zagora" className="h-8 w-8" />
            <div>
              <span className="font-bold text-gray-900 text-base">Open Zagora</span>
              <span className="text-gray-400 text-sm ml-2 hidden sm:inline">Admin</span>
            </div>
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

            {/* Page header */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">EOP Tenders</h1>
                <p className="text-sm text-gray-500 mt-0.5">Public procurement data from EOP</p>
              </div>
              <button onClick={fetchTenders} className="btn-secondary flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4" /><span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {success && (
              <div className="alert-success flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />{success}
              </div>
            )}
            {error && (
              <div className="alert-error flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
                <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
              </div>
            )}

            {viewMode === 'list' ? (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total', value: stats.total, color: 'text-gray-900' },
                    { label: 'Active', value: stats.active, color: 'text-primary-600' },
                    { label: 'Completed', value: stats.completed, color: 'text-green-600' },
                    { label: 'Total Budget', value: formatCurrency(stats.totalBudget), color: 'text-gray-900' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card p-3 sm:p-4">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className={`text-lg sm:text-2xl font-bold mt-0.5 truncate ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Search tenders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="form-input pl-9 text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500 shrink-0" />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-input text-sm py-1.5">
                      <option value="all">All Status</option>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 self-center shrink-0">{filtered.length} / {tenders.length}</p>
                </div>

                {/* Table */}
                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
                ) : (
                  <div className="card overflow-hidden">
                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-gray-100">
                      {filtered.length === 0 ? (
                        <p className="text-center text-gray-500 py-8 text-sm">No tenders found</p>
                      ) : filtered.map(t => (
                        <div key={t.id} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{t.title}</p>
                            <span className={`shrink-0 inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {t.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                            {t.budget && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(t.budget)}</span>}
                            {t.contractor && <span className="truncate max-w-[180px]">{t.contractor}</span>}
                            {t.publication_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(t.publication_date)}</span>}
                          </div>
                          <div className="flex items-center gap-3 pt-1">
                            <button onClick={() => handleEdit(t)} className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs"><Edit2 className="h-3.5 w-3.5" />Edit</button>
                            {t.source_url && <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs"><ExternalLink className="h-3.5 w-3.5" />Source</a>}
                            <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs ml-auto"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Budget</th>
                            <th>Contractor</th>
                            <th>Published</th>
                            <th>Location</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filtered.length === 0 ? (
                            <tr><td colSpan="7" className="text-center py-8 text-gray-500">No tenders found</td></tr>
                          ) : filtered.map(t => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td>
                                <p className="font-medium text-gray-900 max-w-xs truncate">{t.title}</p>
                                {t.eop_id && <p className="text-xs text-gray-400 font-mono">{t.eop_id}</p>}
                              </td>
                              <td>
                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                  {t.status}
                                </span>
                              </td>
                              <td className="text-sm font-medium">{formatCurrency(t.budget)}</td>
                              <td className="text-sm text-gray-600 max-w-[160px] truncate">{t.contractor || '—'}</td>
                              <td className="text-sm text-gray-500">{formatDate(t.publication_date)}</td>
                              <td>
                                {t.lat && t.lng
                                  ? <span className="flex items-center gap-1 text-xs text-primary-600"><MapPin className="h-3 w-3" />{parseFloat(t.lat).toFixed(4)}</span>
                                  : <span className="text-gray-400 text-xs">No coords</span>}
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleEdit(t)} className="p-1 text-primary-600 hover:text-primary-800" title="Edit"><Edit2 className="h-4 w-4" /></button>
                                  {t.source_url && <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="p-1 text-primary-600 hover:text-primary-800" title="Source"><ExternalLink className="h-4 w-4" /></a>}
                                  <button onClick={() => handleDelete(t.id)} className="p-1 text-red-500 hover:text-red-700" title="Delete"><Trash2 className="h-4 w-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Edit Form */
              <div className="card">
                <div className="card-header flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewMode('list')} className="p-1 text-gray-500 hover:text-gray-700"><ChevronLeft className="h-5 w-5" /></button>
                    <h2 className="font-semibold text-gray-900">Edit Tender</h2>
                    {editingTender?.eop_id && <span className="text-xs text-gray-400 font-mono hidden sm:inline">{editingTender.eop_id}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setViewMode('list')} className="btn-secondary text-sm">Cancel</button>
                    <button form="tender-form" type="submit" disabled={isSubmitting} className="btn-primary text-sm">
                      {isSubmitting ? <><Loader2 className="animate-spin h-4 w-4 mr-1" />Saving...</> : <><Save className="h-4 w-4 mr-1" />Save</>}
                    </button>
                  </div>
                </div>

                <form id="tender-form" onSubmit={handleSubmit} className="card-body space-y-5">
                  {formErrors.general && (
                    <div className="alert-error flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{formErrors.general}</div>
                  )}

                  {/* Basic */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FileText className="h-4 w-4 text-primary-600" />Basic Information</h3>
                    <div>
                      <label className="form-label">Title <span className="text-red-500">*</span></label>
                      <input type="text" value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))} className={`form-input ${formErrors.title ? 'border-red-500' : ''}`} />
                      {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Status</label>
                        <select value={formData.status} onChange={e => setFormData(p => ({...p, status: e.target.value}))} className="form-input">
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Budget (BGN)</label>
                        <input type="number" value={formData.budget} onChange={e => setFormData(p => ({...p, budget: e.target.value}))} className="form-input" placeholder="0.00" step="0.01" min="0" />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Contractor</label>
                      <input type="text" value={formData.contractor} onChange={e => setFormData(p => ({...p, contractor: e.target.value}))} className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Description</label>
                      <textarea value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} className="form-input" rows={3} />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><MapPin className="h-4 w-4 text-primary-600" />Location</h3>
                    <div>
                      <label className="form-label">Address</label>
                      <input type="text" value={formData.address} onChange={e => setFormData(p => ({...p, address: e.target.value}))} className="form-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Latitude</label>
                        <input type="text" value={formData.lat} onChange={e => setFormData(p => ({...p, lat: e.target.value}))} className="form-input font-mono" placeholder="42.4257" />
                      </div>
                      <div>
                        <label className="form-label">Longitude</label>
                        <input type="text" value={formData.lng} onChange={e => setFormData(p => ({...p, lng: e.target.value}))} className="form-input font-mono" placeholder="25.6344" />
                      </div>
                    </div>
                    <a href={`https://www.openstreetmap.org/?mlat=${formData.lat||42.4257}&mlng=${formData.lng||25.6344}#map=15/${formData.lat||42.4257}/${formData.lng||25.6344}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm inline-flex items-center gap-2">
                      <Map className="h-4 w-4" />Pick on Map<ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Dates */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary-600" />Dates</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Publication Date</label>
                        <input type="date" value={formData.publication_date} onChange={e => setFormData(p => ({...p, publication_date: e.target.value}))} className="form-input" />
                      </div>
                      <div>
                        <label className="form-label">End Date</label>
                        <input type="date" value={formData.end_date} onChange={e => setFormData(p => ({...p, end_date: e.target.value}))} className="form-input" />
                      </div>
                    </div>
                  </div>

                  {/* Source */}
                  <div>
                    <label className="form-label">Source URL</label>
                    <input type="url" value={formData.source_url} onChange={e => setFormData(p => ({...p, source_url: e.target.value}))} className="form-input" placeholder="https://..." />
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProjectsPage;
