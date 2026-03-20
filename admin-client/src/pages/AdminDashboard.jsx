import React, { useState, useRef, useCallback } from 'react';
import logo from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload, FileText, LogOut, User, Shield,
  CheckCircle, AlertCircle, Loader2, X,
  FileUp, History, ChevronDown, ChevronUp,
  Database, FolderOpen, MapPin, Vote, Archive,
  RefreshCw, LocateFixed, Map, LayoutDashboard, Menu
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Database',         icon: Database,        path: '/database' },
  { label: 'Projects',         icon: MapPin,          path: '/projects' },
  { label: 'Council Votes',    icon: Vote,            path: '/council-votes' },
];

const AdminDashboard = () => {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('single');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('project');
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [folderPath, setFolderPath] = useState('/app/budget-pdfs');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [isProcessingFolder, setIsProcessingFolder] = useState(false);
  const [folderResult, setFolderResult] = useState(null);
  const [folderError, setFolderError] = useState(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapDataResult, setMapDataResult] = useState(null);
  const [mapDataError, setMapDataError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  }, []);

  const handleFileSelect = (file) => {
    const allowed = ['application/pdf', 'application/zip', 'application/x-zip-compressed'];
    if (!allowed.includes(file.type)) { setUploadError('Only PDF and ZIP files are allowed'); return; }
    if (file.size > 50 * 1024 * 1024) { setUploadError('File size must be less than 50MB'); return; }
    setUploadError(null); setSelectedFile(file); setUploadResult(null);
  };

  const clearFile = () => {
    setSelectedFile(null); setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) { setUploadError('Please select a file'); return; }
    setIsUploading(true); setUploadProgress(0); setUploadError(null); setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', documentType);
      if (customTitle.trim()) formData.append('title', customTitle.trim());
      if (customDescription.trim()) formData.append('description', customDescription.trim());
      const response = await api.post('/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total))
      });
      if (response.data.success) {
        setUploadResult(response.data.data);
        setSelectedFile(null); setCustomTitle(''); setCustomDescription('');
        if (showHistory) fetchUploadHistory();
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally { setIsUploading(false); setUploadProgress(0); }
  };

  const fetchUploadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const r = await api.get('/admin/upload/history');
      if (r.data.success) setUploadHistory(r.data.data.uploads || []);
    } catch {}
    finally { setIsLoadingHistory(false); }
  };

  const toggleHistory = () => {
    if (!showHistory) fetchUploadHistory();
    setShowHistory(!showHistory);
  };

  const handleMapDataFetch = async () => {
    setIsFetchingData(true); setMapDataError(null); setMapDataResult(null);
    try {
      const [eopRes, osmRes] = await Promise.allSettled([
        fetch('/api/eop/fetch-and-import', { method: 'POST' }),
        fetch('/api/osm/fetch', { method: 'POST' }),
      ]);
      const eop = eopRes.status === 'fulfilled' ? await eopRes.value.json() : null;
      const osm = osmRes.status === 'fulfilled' ? await osmRes.value.json() : null;
      setMapDataResult({
        eop: eop?.success ? eop.data : null,
        osm: osm?.success ? osm.data : null,
        summary: [
          eop?.success ? `EOP: ${eop.data.import.imported} new, ${eop.data.import.updated} updated` : 'EOP: failed',
          osm?.success ? 'OSM: fetching in background' : 'OSM: failed',
        ].join(' | ')
      });
    } catch (err) { setMapDataError(err.message || 'Failed to fetch map data'); }
    finally { setIsFetchingData(false); }
  };

  const handleGeocode = async () => {
    setIsGeocoding(true); setMapDataError(null); setMapDataResult(null);
    try {
      await fetch('/api/eop/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'hybrid' }) });
      setMapDataResult({ geocoding: true, summary: 'Geocoding started in background. Check map in a few minutes.' });
    } catch (err) { setMapDataError(err.message || 'Failed to start geocoding'); }
    finally { setIsGeocoding(false); }
  };

  const handleFolderUpload = async () => {
    if (!folderPath.trim()) { setFolderError('Please enter a folder path'); return; }
    setIsProcessingFolder(true); setFolderError(null); setFolderResult(null);
    try {
      const r = await api.post('/admin/budget/import', { folderPath: folderPath.trim(), year });
      if (r.data.success) { setFolderResult(r.data.data); if (showHistory) fetchUploadHistory(); }
    } catch (err) { setFolderError(err.response?.data?.message || 'Folder processing failed.'); }
    finally { setIsProcessingFolder(false); }
  };

  const formatDate = (d) => new Date(d).toLocaleString();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Top Header */}
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
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
              <User className="h-4 w-4" />
              <span className="font-medium">{user?.username}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-primary-600 font-semibold uppercase">{user?.role}</span>
            </div>
            <button onClick={logout} className="btn-secondary text-sm flex items-center gap-2">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar overlay on mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-10 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        {/* Sidebar */}
        <aside className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:static top-0 left-0 h-full md:h-auto w-56 bg-white border-r border-gray-200 flex flex-col py-4 gap-1 shrink-0 z-20 transition-transform duration-200 pt-16 md:pt-4`}>
          {NAV.map(({ label, icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                location.pathname === path
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">

            {/* Page title */}
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage uploads, map data, and system operations</p>
            </div>

            {/* Quick nav cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Database Manager', icon: Database, path: '/database', color: 'text-primary-600 bg-primary-50' },
                { label: 'Projects', icon: MapPin, path: '/projects', color: 'text-green-600 bg-green-50' },
                { label: 'Council Votes', icon: Vote, path: '/council-votes', color: 'text-purple-600 bg-purple-50' },
                { label: 'Map Data', icon: Map, path: null, color: 'text-orange-600 bg-orange-50', scroll: 'map-section' },
              ].map(({ label, icon: Icon, path, color, scroll }) => (
                <button
                  key={label}
                  onClick={() => path ? navigate(path) : document.getElementById(scroll)?.scrollIntoView({ behavior: 'smooth' })}
                  className="card p-4 text-left hover:shadow-md transition-shadow"
                >
                  <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                </button>
              ))}
            </div>

            {/* Upload + Map Data row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Upload Card — takes 2 cols */}
              <div className="lg:col-span-2 card">
                <div className="card-header flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-primary-600" />
                  <h2 className="font-semibold text-gray-900">PDF Document Upload</h2>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 flex">
                  {[['single', FileText, 'Single File'], ['folder', FolderOpen, 'Full Year Folder']].map(([tab, Icon, label]) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />{label}
                    </button>
                  ))}
                </div>

                <div className="card-body space-y-4">
                  {activeTab === 'single' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Document Type</label>
                          <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="form-input" disabled={isUploading}>
                            <option value="project">Municipal Project</option>
                            <option value="budget">Budget Document</option>
                            <option value="vote">Council Vote</option>
                            <option value="unknown">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Custom Title <span className="text-gray-400 font-normal">(optional)</span></label>
                          <input type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)} className="form-input" placeholder="Override extracted title" disabled={isUploading} />
                        </div>
                      </div>

                      {!selectedFile ? (
                        <div
                          className={`drag-drop-zone ${dragActive ? 'drag-over' : ''}`}
                          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input ref={fileInputRef} type="file" accept=".pdf,.zip" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} className="hidden" disabled={isUploading} />
                          <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                          <p className="font-medium text-gray-900">Drop PDF or ZIP here</p>
                          <p className="text-sm text-gray-500 mt-1">or click to browse · max 50MB</p>
                        </div>
                      ) : (
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {selectedFile.type.includes('zip') ? <Archive className="h-7 w-7 text-primary-600" /> : <FileText className="h-7 w-7 text-primary-600" />}
                              <div>
                                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                                <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            {!isUploading && <button onClick={clearFile} className="text-gray-400 hover:text-danger-600"><X className="h-5 w-5" /></button>}
                          </div>
                          {isUploading && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-gray-600 mb-1"><span>Uploading...</span><span>{uploadProgress}%</span></div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-primary-600 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} /></div>
                            </div>
                          )}
                        </div>
                      )}

                      {uploadError && <div className="alert-error flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{uploadError}</div>}
                      {uploadResult && (
                        <div className="alert-success flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Upload successful!</p>
                            <p className="text-sm mt-0.5">{uploadResult.totalFiles} file(s) · {uploadResult.successfulFiles} successful · {uploadResult.totalItemsParsed?.toLocaleString()} items parsed</p>
                          </div>
                        </div>
                      )}

                      <button onClick={handleUpload} disabled={!selectedFile || isUploading} className="btn-primary w-full">
                        {isUploading ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload Document</>}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Budget Year</label>
                          <select value={year} onChange={e => setYear(e.target.value)} className="form-input" disabled={isProcessingFolder}>
                            {['2025','2024','2023','2022','2020'].map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Folder Path</label>
                          <input type="text" value={folderPath} onChange={e => setFolderPath(e.target.value)} className="form-input" placeholder="/app/budget-pdfs" disabled={isProcessingFolder} />
                        </div>
                      </div>

                      {folderError && <div className="alert-error flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{folderError}</div>}
                      {folderResult && (
                        <div className="alert-success flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Folder processed!</p>
                            <div className="text-sm mt-1 grid grid-cols-2 gap-x-4">
                              {['income','expenses','indicators','loans','villages','forecasts'].map(k => (
                                <p key={k}>• {k}: {folderResult.summary?.[k]?.items || 0}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <button onClick={handleFolderUpload} disabled={!folderPath.trim() || isProcessingFolder} className="btn-primary w-full">
                        {isProcessingFolder ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />Processing...</> : <><FolderOpen className="h-4 w-4 mr-2" />Process Year Folder</>}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Right column: user info + security */}
              <div className="space-y-4">
                <div className="card">
                  <div className="card-header flex items-center gap-2">
                    <User className="h-4 w-4 text-primary-600" />
                    <h2 className="font-semibold text-gray-900">Administrator</h2>
                  </div>
                  <div className="card-body space-y-3">
                    {[['Username', user?.username], ['Email', user?.email]].map(([l, v]) => (
                      <div key={l}>
                        <p className="text-xs font-medium text-gray-500 uppercase">{l}</p>
                        <p className="text-sm text-gray-900 mt-0.5">{v}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Role</p>
                      <span className={`inline-flex mt-0.5 px-2 py-0.5 text-xs font-semibold rounded-full ${user?.role === 'super_admin' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-800'}`}>
                        {user?.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary-600" />
                    <h2 className="font-semibold text-gray-900">Security</h2>
                  </div>
                  <div className="card-body">
                    <div className="flex items-center gap-2 text-sm text-success-700 bg-success-50 p-2.5 rounded-md mb-3">
                      <Shield className="h-4 w-4 shrink-0" /> Authenticated & secure
                    </div>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• All actions are logged</li>
                      <li>• Session expires after 24h</li>
                      <li>• Uploads are validated</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Data Management */}
            <div id="map-section" className="card">
              <div className="card-header flex items-center gap-2">
                <Map className="h-4 w-4 text-primary-600" />
                <h2 className="font-semibold text-gray-900">Map Data Management</h2>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Fetch fresh data from external sources (EOP + OSM) and geocode tenders without coordinates.</p>
                    {mapDataResult && (
                      <div className="alert-success flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Done!</p>
                          <p className="text-xs mt-0.5">{mapDataResult.summary}</p>
                        </div>
                      </div>
                    )}
                    {mapDataError && (
                      <div className="alert-error flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span className="text-sm">{mapDataError}</span>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={handleMapDataFetch} disabled={isFetchingData} className="btn-primary flex-1">
                        {isFetchingData ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />Fetching...</> : <><RefreshCw className="h-4 w-4 mr-2" />Fetch Data</>}
                      </button>
                      <button onClick={handleGeocode} disabled={isGeocoding} className="btn-secondary flex-1">
                        {isGeocoding ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />Starting...</> : <><LocateFixed className="h-4 w-4 mr-2" />Locate Tenders</>}
                      </button>
                    </div>
                  </div>
                  <ul className="text-xs text-gray-500 space-y-2 self-center">
                    <li>• <strong>Fetch Data</strong> — pulls new tenders from EOP and POIs from OSM</li>
                    <li>• <strong>Locate Tenders</strong> — adds coordinates to tenders missing location</li>
                    <li>• Geocoding runs in background — check map after a few minutes</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Upload History */}
            <div className="card">
              <div className="card-header flex items-center justify-between cursor-pointer" onClick={toggleHistory}>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary-600" />
                  <h2 className="font-semibold text-gray-900">Upload History</h2>
                </div>
                {showHistory ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
              {showHistory && (
                <div className="card-body">
                  {isLoadingHistory ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-primary-600" /></div>
                  ) : uploadHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-8 text-sm">No upload history found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="admin-table">
                        <thead><tr><th>Date</th><th>File</th><th>Type</th><th>Status</th></tr></thead>
                        <tbody className="divide-y divide-gray-200">
                          {uploadHistory.map(u => (
                            <tr key={u.id}>
                              <td className="text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                              <td className="text-sm">{u.details?.originalName || '—'}</td>
                              <td className="text-xs text-gray-500">{u.details?.documentType || '—'}</td>
                              <td>
                                {u.success
                                  ? <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-success-100 text-success-800">Success</span>
                                  : <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-danger-100 text-danger-800">Failed</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
