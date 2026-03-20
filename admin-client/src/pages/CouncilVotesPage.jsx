import React, { useState, useEffect } from 'react';
import logo from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Vote, Plus, Search, Filter, Edit2, Trash2,
  Loader2, CheckCircle, AlertCircle, X, Save,
  RefreshCw, Calendar, FileText, BarChart3,
  Shield, LogOut, User, Database, MapPin,
  LayoutDashboard, Menu, ChevronLeft
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Database',      icon: Database,        path: '/database' },
  { label: 'Projects',      icon: MapPin,          path: '/projects' },
  { label: 'Council Votes', icon: Vote,            path: '/council-votes' },
];

const RESULT_OPTIONS = [
  { value: 'passed',    label: 'Passed',    color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'rejected',  label: 'Rejected',  color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'postponed', label: 'Postponed', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
];

const EMPTY_FORM = {
  session_date: new Date().toISOString().split('T')[0],
  proposal_title: '', vote_yes: 0, vote_no: 0, vote_abstain: 0,
  result: 'passed', raw_text: ''
};

const CouncilVotesPage = () => {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const [viewMode, setViewMode] = useState('list');
  const [editingVote, setEditingVote] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchVotes(); }, []);

  const fetchVotes = async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get('/admin/database/council_votes?limit=500');
      setVotes(r.data?.data?.records || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch council votes');
    } finally { setLoading(false); }
  };

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  const years = [...new Set(votes.map(v => v.session_date ? new Date(v.session_date).getFullYear() : null).filter(Boolean))].sort((a,b) => b-a);

  const filtered = votes.filter(v => {
    const matchResult = resultFilter === 'all' || v.result === resultFilter;
    const matchYear = yearFilter === 'all' || (v.session_date && new Date(v.session_date).getFullYear().toString() === yearFilter);
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || v.proposal_title?.toLowerCase().includes(q);
    return matchResult && matchYear && matchSearch;
  });

  const stats = {
    total: votes.length,
    passed: votes.filter(v => v.result === 'passed').length,
    rejected: votes.filter(v => v.result === 'rejected').length,
    postponed: votes.filter(v => v.result === 'postponed').length,
    passRate: votes.length > 0 ? Math.round((votes.filter(v => v.result === 'passed').length / votes.length) * 100) : 0,
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('bg-BG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const totalVotes = (v) => (parseInt(v.vote_yes)||0) + (parseInt(v.vote_no)||0) + (parseInt(v.vote_abstain)||0);

  const getResultBadge = (result) => {
    const opt = RESULT_OPTIONS.find(o => o.value === result);
    return <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${opt?.color || 'bg-gray-100 text-gray-700 border-gray-200'}`}>{opt?.label || result}</span>;
  };

  const autoResult = () => {
    const yes = parseInt(formData.vote_yes)||0, no = parseInt(formData.vote_no)||0;
    return yes > no ? 'passed' : no > yes ? 'rejected' : 'postponed';
  };

  const handleCreate = () => {
    setEditingVote(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setViewMode('form');
  };

  const handleEdit = (vote) => {
    setEditingVote(vote);
    setFormData({
      session_date: vote.session_date?.split('T')[0] || '',
      proposal_title: vote.proposal_title || '',
      vote_yes: vote.vote_yes || 0,
      vote_no: vote.vote_no || 0,
      vote_abstain: vote.vote_abstain || 0,
      result: vote.result || 'passed',
      raw_text: vote.raw_text || '',
    });
    setFormErrors({});
    setViewMode('form');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this vote record?')) return;
    try {
      await api.delete(`/admin/database/council_votes/${id}`);
      showSuccess('Vote record deleted');
      fetchVotes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.session_date) errors.session_date = 'Required';
    if (!formData.proposal_title?.trim()) errors.proposal_title = 'Required';
    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    setIsSubmitting(true);
    try {
      if (editingVote) {
        await api.put(`/admin/database/council_votes/${editingVote.id}`, formData);
      } else {
        await api.post('/admin/database/council_votes', formData);
      }
      showSuccess(editingVote ? 'Vote updated' : 'Vote created');
      fetchVotes();
      setViewMode('list');
    } catch (err) {
      setFormErrors({ general: err.response?.data?.message || 'Failed to save' });
    } finally { setIsSubmitting(false); }
  };

  const field = (name, val) => setFormData(p => ({ ...p, [name]: val }));

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
              <div>
                <h1 className="text-xl font-bold text-gray-900">Council Votes</h1>
                <p className="text-sm text-gray-500 mt-0.5">Municipal council voting records</p>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchVotes} className="btn-secondary flex items-center gap-2 text-sm"><RefreshCw className="h-4 w-4" /></button>
                <button onClick={handleCreate} className="btn-primary flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New Vote</span></button>
              </div>
            </div>

            {success && <div className="alert-success flex items-center gap-2"><CheckCircle className="h-4 w-4 shrink-0" />{success}</div>}
            {error && <div className="alert-error flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}<button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button></div>}

            {viewMode === 'list' ? (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Total', value: stats.total, color: 'text-gray-900', border: '' },
                    { label: 'Passed', value: stats.passed, color: 'text-green-600', border: 'border-l-4 border-green-500' },
                    { label: 'Rejected', value: stats.rejected, color: 'text-red-600', border: 'border-l-4 border-red-500' },
                    { label: 'Postponed', value: stats.postponed, color: 'text-yellow-600', border: 'border-l-4 border-yellow-500' },
                    { label: 'Pass Rate', value: `${stats.passRate}%`, color: 'text-primary-600', border: 'border-l-4 border-primary-500' },
                  ].map(({ label, value, color, border }) => (
                    <div key={label} className={`card p-3 sm:p-4 ${border}`}>
                      <p className={`text-lg sm:text-2xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Search proposals..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="form-input pl-9 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} className="form-input text-sm py-1.5 flex-1 sm:w-36">
                      <option value="all">All Results</option>
                      {RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="form-input text-sm py-1.5 flex-1 sm:w-28">
                      <option value="all">All Years</option>
                      {years.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 self-center shrink-0">{filtered.length} / {votes.length}</p>
                </div>

                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
                ) : (
                  <div className="card overflow-hidden">
                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-gray-100">
                      {filtered.length === 0 ? (
                        <p className="text-center text-gray-500 py-8 text-sm">No vote records found</p>
                      ) : filtered.map(v => (
                        <div key={v.id} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 flex-1 line-clamp-2">{v.proposal_title}</p>
                            {getResultBadge(v.result)}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(v.session_date)}</span>
                            <span className="text-green-600 font-medium">{v.vote_yes} За</span>
                            <span className="text-red-600 font-medium">{v.vote_no} Против</span>
                            <span className="text-gray-500">{v.vote_abstain} Възд.</span>
                          </div>
                          <div className="flex gap-3 pt-1">
                            <button onClick={() => handleEdit(v)} className="text-primary-600 text-xs flex items-center gap-1"><Edit2 className="h-3.5 w-3.5" />Edit</button>
                            <button onClick={() => handleDelete(v.id)} className="text-red-500 text-xs flex items-center gap-1 ml-auto"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="admin-table">
                        <thead><tr><th>Date</th><th>Proposal</th><th className="text-center">Yes</th><th className="text-center">No</th><th className="text-center">Abstain</th><th className="text-center">Total</th><th>Result</th><th>Actions</th></tr></thead>
                        <tbody className="divide-y divide-gray-200">
                          {filtered.length === 0 ? (
                            <tr><td colSpan="8" className="text-center py-8 text-gray-500">No vote records found</td></tr>
                          ) : filtered.map(v => (
                            <tr key={v.id} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap text-sm text-gray-600">{formatDate(v.session_date)}</td>
                              <td>
                                <p className="font-medium text-gray-900 max-w-xs truncate">{v.proposal_title}</p>
                                {v.raw_text && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><FileText className="h-3 w-3" />Has document</p>}
                              </td>
                              <td className="text-center font-semibold text-green-600">{v.vote_yes||0}</td>
                              <td className="text-center font-semibold text-red-600">{v.vote_no||0}</td>
                              <td className="text-center font-semibold text-gray-500">{v.vote_abstain||0}</td>
                              <td className="text-center font-medium">{totalVotes(v)}</td>
                              <td>{getResultBadge(v.result)}</td>
                              <td>
                                <div className="flex gap-2">
                                  <button onClick={() => handleEdit(v)} className="p-1 text-primary-600 hover:text-primary-800"><Edit2 className="h-4 w-4" /></button>
                                  <button onClick={() => handleDelete(v.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
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
              /* Form */
              <div className="card">
                <div className="card-header flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewMode('list')} className="p-1 text-gray-500 hover:text-gray-700"><ChevronLeft className="h-5 w-5" /></button>
                    <h2 className="font-semibold text-gray-900">{editingVote ? 'Edit Vote Record' : 'New Vote Record'}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setViewMode('list')} className="btn-secondary text-sm">Cancel</button>
                    <button form="vote-form" type="submit" disabled={isSubmitting} className="btn-primary text-sm">
                      {isSubmitting ? <><Loader2 className="animate-spin h-4 w-4 mr-1" />Saving...</> : <><Save className="h-4 w-4 mr-1" />Save</>}
                    </button>
                  </div>
                </div>

                <form id="vote-form" onSubmit={handleSubmit} className="card-body space-y-5">
                  {formErrors.general && <div className="alert-error flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{formErrors.general}</div>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Session Date <span className="text-red-500">*</span></label>
                      <input type="date" value={formData.session_date} onChange={e => field('session_date', e.target.value)} className={`form-input ${formErrors.session_date ? 'border-red-500' : ''}`} />
                      {formErrors.session_date && <p className="text-xs text-red-500 mt-1">{formErrors.session_date}</p>}
                    </div>
                    <div>
                      <label className="form-label">Result</label>
                      <select value={formData.result} onChange={e => field('result', e.target.value)} className="form-input">
                        {RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Proposal Title <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.proposal_title} onChange={e => field('proposal_title', e.target.value)} className={`form-input ${formErrors.proposal_title ? 'border-red-500' : ''}`} placeholder="Enter proposal title" />
                    {formErrors.proposal_title && <p className="text-xs text-red-500 mt-1">{formErrors.proposal_title}</p>}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Vote className="h-4 w-4 text-primary-600" />Voting Results</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[['vote_yes','YES','text-green-600'],['vote_no','NO','text-red-600'],['vote_abstain','Abstain','text-gray-500']].map(([name, label, color]) => (
                        <div key={name}>
                          <label className="form-label">{label}</label>
                          <input type="number" value={formData[name]} onChange={e => field(name, parseInt(e.target.value)||0)} className={`form-input text-center font-semibold ${color}`} min="0" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total: <strong>{(parseInt(formData.vote_yes)||0)+(parseInt(formData.vote_no)||0)+(parseInt(formData.vote_abstain)||0)}</strong></span>
                      <span className="text-gray-600">Auto-detected: {getResultBadge(autoResult())}</span>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Raw Document Text <span className="text-gray-400 font-normal">(optional)</span></label>
                    <textarea value={formData.raw_text} onChange={e => field('raw_text', e.target.value)} className="form-input font-mono text-sm" rows={4} placeholder="Paste original document text or meeting minutes..." />
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

export default CouncilVotesPage;
