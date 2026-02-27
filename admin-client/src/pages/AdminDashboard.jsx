/**
 * Admin Dashboard Page
 * 
 * Main admin interface with PDF upload functionality
 * Enterprise-grade with drag-and-drop, progress tracking, and audit logging
 */

import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Upload, FileText, LogOut, User, Shield, 
  CheckCircle, AlertCircle, Loader2, X, 
  FileUp, History, Settings, ChevronDown, ChevronUp,
  Database, Lock
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout, api } = useAuth();
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
  
  const fileInputRef = useRef(null);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop event
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  // Handle file selection
  const handleFileSelect = (file) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are allowed');
      setSelectedFile(null);
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size must be less than 50MB');
      setSelectedFile(null);
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
    setUploadResult(null);
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a PDF file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      formData.append('type', documentType);
      if (customTitle.trim()) {
        formData.append('title', customTitle.trim());
      }
      if (customDescription.trim()) {
        formData.append('description', customDescription.trim());
      }

      const response = await api.post('/api/admin/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(progress);
        }
      });

      if (response.data.success) {
        setUploadResult(response.data.data);
        setSelectedFile(null);
        setCustomTitle('');
        setCustomDescription('');
        
        // Refresh upload history
        if (showHistory) {
          fetchUploadHistory();
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Upload failed. Please try again.';
      setUploadError(errorMessage);
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Fetch upload history
  const fetchUploadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await api.get('/api/admin/upload/history');
      if (response.data.success) {
        setUploadHistory(response.data.data.uploads || []);
      }
    } catch (err) {
      console.error('Failed to fetch upload history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Toggle history view
  const toggleHistory = () => {
    if (!showHistory) {
      fetchUploadHistory();
    }
    setShowHistory(!showHistory);
  };

  // Clear selected file
  const clearFile = () => {
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Get document type label
  const getDocumentTypeLabel = (type) => {
    const labels = {
      project: 'Municipal Project',
      budget: 'Budget Document',
      vote: 'Council Vote',
      council_vote: 'Council Vote',
      unknown: 'Unknown Document'
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-primary-600 rounded-lg p-2 mr-3">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Open Zagora Admin</h1>
                <p className="text-xs text-gray-500">Enterprise Management Interface</p>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Card */}
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center">
                  <FileUp className="h-5 w-5 text-primary-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">PDF Document Upload</h2>
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <Database className="h-4 w-4 mr-1" />
                  Main Database
                </div>
              </div>
              
              <div className="card-body space-y-6">
                {/* Document Type Selection */}
                <div>
                  <label className="form-label">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="form-input"
                    disabled={isUploading}
                  >
                    <option value="project">Municipal Project</option>
                    <option value="budget">Budget Document</option>
                    <option value="vote">Council Vote Record</option>
                    <option value="unknown">Other Document</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    This determines how the document is processed and stored
                  </p>
                </div>

                {/* Custom Title (Optional) */}
                <div>
                  <label className="form-label">
                    Custom Title <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="form-input"
                    placeholder="Override extracted title"
                    disabled={isUploading}
                  />
                </div>

                {/* Custom Description (Optional) */}
                <div>
                  <label className="form-label">
                    Description <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    className="form-input"
                    rows={3}
                    placeholder="Additional context about this document"
                    disabled={isUploading}
                  />
                </div>

                {/* Drag and Drop Zone */}
                <div>
                  <label className="form-label">PDF File</label>
                  
                  {!selectedFile ? (
                    <div
                      className={`drag-drop-zone ${dragActive ? 'drag-over' : ''}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileInputChange}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        Drop your PDF here
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        or click to browse from your computer
                      </p>
                      <p className="text-xs text-gray-400">
                        Maximum file size: 50MB
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-8 w-8 text-primary-600 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        {!isUploading && (
                          <button
                            onClick={clearFile}
                            className="text-gray-400 hover:text-danger-600 transition-colors"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                      
                      {isUploading && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                            <span>Uploading...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {uploadError && (
                  <div className="alert-error flex items-start">
                    <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Success Message */}
                {uploadResult && (
                  <div className="alert-success">
                    <div className="flex items-start">
                      <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Upload successful!</p>
                        <p className="text-sm mt-1">
                          Document stored in {uploadResult.databaseResult?.table} table
                          {uploadResult.databaseResult?.id && ` (ID: ${uploadResult.databaseResult.id})`}
                        </p>
                        <p className="text-sm mt-1">
                          Pages: {uploadResult.pageCount} | 
                          Text: {uploadResult.textLength.toLocaleString()} characters
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="btn-primary w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mr-2" />
                      Upload PDF Document
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Upload History */}
            <div className="card">
              <div 
                className="card-header flex items-center justify-between cursor-pointer"
                onClick={toggleHistory}
              >
                <div className="flex items-center">
                  <History className="h-5 w-5 text-primary-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Upload History</h2>
                </div>
                {showHistory ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
              
              {showHistory && (
                <div className="card-body">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin h-6 w-6 text-primary-600" />
                    </div>
                  ) : uploadHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No upload history found
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Action</th>
                            <th>Document</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {uploadHistory.map((upload) => (
                            <tr key={upload.id}>
                              <td className="text-gray-500">
                                {formatDate(upload.created_at)}
                              </td>
                              <td>
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  upload.action === 'upload_success' 
                                    ? 'bg-success-100 text-success-800' 
                                    : 'bg-danger-100 text-danger-800'
                                }`}>
                                  {upload.action === 'upload_success' ? 'Success' : 'Failed'}
                                </span>
                              </td>
                              <td>
                                {upload.details?.originalName || 'Unknown'}
                                <br />
                                <span className="text-xs text-gray-500">
                                  {getDocumentTypeLabel(upload.details?.documentType)}
                                </span>
                              </td>
                              <td>
                                {upload.success ? (
                                  <CheckCircle className="h-5 w-5 text-success-600" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-danger-600" />
                                )}
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

          {/* Right Column - Info & Stats */}
          <div className="space-y-6">
            {/* User Info Card */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="h-5 w-5 text-primary-600 mr-2" />
                  Administrator Info
                </h2>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Username</label>
                  <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                  <p className="text-sm text-gray-900">{user?.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Role</label>
                  <p className="text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user?.role === 'super_admin' 
                        ? 'bg-primary-100 text-primary-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user?.role}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Security Info Card */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Lock className="h-5 w-5 text-primary-600 mr-2" />
                  Security Status
                </h2>
              </div>
              <div className="card-body space-y-4">
                <div className="flex items-center text-sm text-success-700 bg-success-50 p-3 rounded-md">
                  <Shield className="h-5 w-5 mr-2 flex-shrink-0" />
                  <span>Authenticated and secure</span>
                </div>
                
                <div className="text-xs text-gray-600 space-y-2">
                  <p>• All actions are logged and audited</p>
                  <p>• Session expires after 24 hours</p>
                  <p>• Uploads are scanned and validated</p>
                  <p>• Database connections are encrypted</p>
                </div>
              </div>
            </div>

            {/* Quick Help Card */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Settings className="h-5 w-5 text-primary-600 mr-2" />
                  Document Types
                </h2>
              </div>
              <div className="card-body">
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">Municipal Project</p>
                    <p className="text-gray-600 text-xs">Construction, renovation, and infrastructure projects</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Budget Document</p>
                    <p className="text-gray-600 text-xs">Annual budgets, allocations, and financial reports</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Council Vote</p>
                    <p className="text-gray-600 text-xs">Meeting minutes and voting records</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
