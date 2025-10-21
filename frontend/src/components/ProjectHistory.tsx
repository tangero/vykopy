import React, { useState, useEffect } from 'react';
import './ProjectHistory.css';

interface ProjectHistoryEntry {
  id: string;
  timestamp: Date;
  action: 'create' | 'update' | 'delete' | 'state_change' | 'comment';
  userId?: string;
  userName?: string;
  userRole?: string;
  description: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  ipAddress?: string;
}

interface ProjectHistoryProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryFilters {
  startDate?: string;
  endDate?: string;
  action?: string;
  userId?: string;
}

const ProjectHistory: React.FC<ProjectHistoryProps> = ({ projectId, isOpen, onClose }) => {
  const [history, setHistory] = useState<ProjectHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    if (isOpen && projectId) {
      fetchHistory();
    }
  }, [isOpen, projectId, filters, pagination.page]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      });

      const response = await fetch(`/api/projects/${projectId}/history?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch project history');
      }

      const data = await response.json();
      
      // Convert timestamp strings to Date objects
      const historyWithDates = data.history.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));

      setHistory(historyWithDates);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = async () => {
    try {
      const params = new URLSearchParams(filters);
      
      const response = await fetch(`/api/projects/${projectId}/history/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export history');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}-history.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export history');
    }
  };

  const handleFilterChange = (key: keyof HistoryFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return '➕';
      case 'update':
        return '✏️';
      case 'state_change':
        return '🔄';
      case 'comment':
        return '💬';
      case 'delete':
        return '🗑️';
      default:
        return '📝';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'green';
      case 'update':
        return 'blue';
      case 'state_change':
        return 'orange';
      case 'comment':
        return 'purple';
      case 'delete':
        return 'red';
      default:
        return 'gray';
    }
  };

  const formatUserRole = (role?: string) => {
    switch (role) {
      case 'regional_admin':
        return 'Regional Administrator';
      case 'municipal_coordinator':
        return 'Municipal Coordinator';
      case 'applicant':
        return 'Applicant';
      default:
        return role || 'Unknown';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="project-history-overlay">
      <div className="project-history-modal">
        <div className="project-history-header">
          <h2>Project History</h2>
          <div className="project-history-actions">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button
              onClick={exportToCsv}
              className="btn btn-secondary"
              disabled={loading}
            >
              Export CSV
            </button>
            <button onClick={onClose} className="btn btn-close">
              ✕
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="project-history-filters">
            <div className="filter-row">
              <div className="filter-group">
                <label>Start Date:</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>End Date:</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>Action:</label>
                <select
                  value={filters.action || ''}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                >
                  <option value="">All Actions</option>
                  <option value="create">Created</option>
                  <option value="update">Updated</option>
                  <option value="state_change">State Changed</option>
                  <option value="comment">Comment Added</option>
                  <option value="delete">Deleted</option>
                </select>
              </div>
              <div className="filter-actions">
                <button onClick={clearFilters} className="btn btn-secondary">
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="project-history-content">
          {loading && <div className="loading">Loading history...</div>}
          
          {error && (
            <div className="error-message">
              {error}
              <button onClick={fetchHistory} className="btn btn-secondary">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="no-history">No history entries found.</div>
          )}

          {!loading && !error && history.length > 0 && (
            <>
              <div className="history-timeline">
                {history.map((entry) => (
                  <div key={entry.id} className="history-entry">
                    <div className="history-icon" style={{ color: getActionColor(entry.action) }}>
                      {getActionIcon(entry.action)}
                    </div>
                    <div className="history-content">
                      <div className="history-header">
                        <span className="history-description">{entry.description}</span>
                        <span className="history-timestamp">
                          {entry.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <div className="history-meta">
                        {entry.userName && (
                          <span className="history-user">
                            by {entry.userName} ({formatUserRole(entry.userRole)})
                          </span>
                        )}
                        {entry.ipAddress && (
                          <span className="history-ip">from {entry.ipAddress}</span>
                        )}
                      </div>
                      {entry.changes && entry.changes.length > 0 && (
                        <div className="history-changes">
                          <strong>Changes:</strong>
                          <ul>
                            {entry.changes.map((change, index) => (
                              <li key={index}>
                                <strong>{change.field}:</strong> {change.oldValue} → {change.newValue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <div className="history-pagination">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="btn btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total entries)
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="btn btn-secondary"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectHistory;