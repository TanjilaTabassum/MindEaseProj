import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPsychologistSummary, getAssignedCases } from '../../api/psychologistApi';
import DashboardPlaceholder from '../../components/common/DashboardPlaceholder';

// Psychologist dashboard.
//
// Styling note (demo item 7): this page was written with Tailwind utility
// classes, but Tailwind is not installed in this project - no dependency, no
// config, no directives in index.css - so every one of those classes did
// nothing and the page rendered unstyled, with the icons at their natural
// size. Installing Tailwind now would restyle every other page, so this uses
// the same inline-style approach as the admin and seeker dashboards instead.
//
// The data loading, filtering, sorting and pagination below are unchanged.

const colors = {
  text: '#2d3748',
  muted: '#718096',
  border: '#e2e8f0',
  panel: '#ffffff',
  green: '#2f855a',
  greenDark: '#276749',
};

const styles = {
  page: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },
  heading: { margin: 0, color: colors.text, fontSize: '24px', fontWeight: 600 },
  sub: { margin: '4px 0 0', color: colors.muted, fontSize: '14px', maxWidth: '560px' },
  button: {
    backgroundColor: colors.green,
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
  },
  buttonDisabled: {
    backgroundColor: '#9ae6b4',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'default',
    fontWeight: 600,
    fontSize: '13px',
  },
  smallButton: {
    backgroundColor: '#edf2f7',
    color: colors.text,
    border: `1px solid ${colors.border}`,
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '12px',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  card: {
    backgroundColor: colors.panel,
    padding: '20px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
  },
  cardLabel: { margin: 0, fontSize: '13px', color: colors.muted },
  cardValue: { margin: '6px 0 4px', fontSize: '28px', fontWeight: 700, color: colors.text },
  cardHint: { margin: 0, fontSize: '13px', color: colors.muted },
  panel: {
    backgroundColor: colors.panel,
    padding: '20px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
    paddingBottom: '16px',
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: '16px',
  },
  input: {
    padding: '8px 12px',
    border: `1px solid #cbd5e0`,
    borderRadius: '6px',
    fontSize: '13px',
    minWidth: '200px',
  },
  select: {
    padding: '8px 12px',
    border: `1px solid #cbd5e0`,
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#fff',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    color: colors.muted,
    fontSize: '12px',
    fontWeight: 600,
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: '#f7fafc',
  },
  td: { padding: '12px', borderBottom: `1px solid ${colors.border}`, color: colors.text },
  badge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
  },
  empty: { textAlign: 'center', padding: '40px 20px', color: colors.muted },
  errorBox: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fed7d7',
    color: '#822727',
    padding: '12px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  pager: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    paddingTop: '16px',
    borderTop: `1px solid ${colors.border}`,
    marginTop: '16px',
    fontSize: '13px',
    color: colors.muted,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(45, 55, 72, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 50,
  },
  modal: {
    backgroundColor: colors.panel,
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    padding: '24px',
    maxWidth: '520px',
    width: '100%',
  },
};

// Badge colours per case status, replacing the Tailwind class strings.
const STATUS_BADGE = {
  pending: { backgroundColor: '#feebc8', color: '#744210' },
  accepted: { backgroundColor: '#bee3f8', color: '#2a4365' },
  completed: { backgroundColor: '#c6f6d5', color: '#22543d' },
  rejected: { backgroundColor: '#fed7d7', color: '#822727' },
};

const badgeStyle = (status) => ({
  ...styles.badge,
  ...(STATUS_BADGE[String(status || '').toLowerCase()] || {
    backgroundColor: '#e2e8f0',
    color: colors.text,
  }),
});

const PsychologistDashboard = () => {
  const navigate = useNavigate();

  // Retrieve user account approval status from local context/storage
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
      console.error('Failed to parse stored user profile:', e);
      return {};
    }
  }, []);

  const isApproved = storedUser.isApproved ?? true; // Default fallback to true for active clinical access

  // Core Data & State Declarations
  const [summary, setSummary] = useState({ pending: 0, accepted: 0, completed: 0 });
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Dynamic Loading & Error States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCaseModal, setSelectedCaseModal] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Primary Fetch Function with Abort & Refresh Logic
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [summaryRes, casesRes] = await Promise.all([
        getPsychologistSummary(),
        getAssignedCases(statusFilter, 1, 50, sortBy, sortOrder),
      ]);

      if (summaryRes && summaryRes.success) {
        setSummary(summaryRes.data || { pending: 0, accepted: 0, completed: 0 });
      }

      if (casesRes && casesRes.success) {
        setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
      }
    } catch (err) {
      console.error('Psychologist Dashboard loading exception:', err);
      setError(err.message || 'An unexpected network error occurred while updating workspace records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (isApproved) {
      loadDashboardData();
    }
  }, [isApproved, loadDashboardData]);

  // Client-side Search and Filter Transformation
  const processedCases = useMemo(() => {
    return cases
      .filter((c) => {
        const seekerName = c.seeker?.name?.toLowerCase() || '';
        const caseId = c._id?.toLowerCase() || '';
        const volunteerName = c.volunteer?.name?.toLowerCase() || '';
        const query = searchQuery.toLowerCase().trim();

        if (!query) return true;
        return seekerName.includes(query) || caseId.includes(query) || volunteerName.includes(query);
      })
      .sort((a, b) => {
        const factor = sortOrder === 'asc' ? 1 : -1;
        if (sortBy === 'seekerName') {
          return (a.seeker?.name || '').localeCompare(b.seeker?.name || '') * factor;
        }
        if (sortBy === 'status') {
          return (a.status || '').localeCompare(b.status || '') * factor;
        }
        return (new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now())) * factor;
      });
  }, [cases, searchQuery, sortBy, sortOrder]);

  // Paginated View Slice
  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedCases.slice(startIndex, startIndex + itemsPerPage);
  }, [processedCases, currentPage]);

  const totalPages = Math.ceil(processedCases.length / itemsPerPage) || 1;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // The case page lives at /dashboard/psychologist/cases/:caseId. The old links
  // pointed at /psychologist/case/:id, which is not a route, so both buttons
  // used to land on "Page Not Found".
  const openCase = (id) => navigate(`/dashboard/psychologist/cases/${id}`);

  // Account Unapproved Fallback Render
  if (!isApproved) {
    return (
      <DashboardPlaceholder
        role="Psychologist"
        greeting="Your sessions and clients, in one place."
        note="Your account must be approved by an admin before seekers can book sessions with you."
        plannedFeatures={[
          'View upcoming clinical sessions',
          'Manage appointment availability slots',
          'Review escalated cases handed over by volunteers',
          'Maintain private encrypted session records',
        ]}
      />
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.heading}>Cases and consultations</h2>
          <p style={styles.sub}>
            Review escalated cases, accept or reject incoming requests, and keep private notes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadDashboardData(true)}
          disabled={refreshing || loading}
          style={refreshing || loading ? styles.buttonDisabled : styles.button}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div style={styles.cards}>
        <div style={styles.card} data-testid="stat-pending">
          <p style={styles.cardLabel}>Pending</p>
          <p style={styles.cardValue}>{summary.pending || 0}</p>
          <p style={styles.cardHint}>Waiting for you to accept or reject</p>
        </div>
        <div style={styles.card} data-testid="stat-accepted">
          <p style={styles.cardLabel}>Active</p>
          <p style={styles.cardValue}>{summary.accepted || 0}</p>
          <p style={styles.cardHint}>Consultations in progress</p>
        </div>
        <div style={styles.card} data-testid="stat-completed">
          <p style={styles.cardLabel}>Completed</p>
          <p style={styles.cardValue}>{summary.completed || 0}</p>
          <p style={styles.cardHint}>Cases you have closed</p>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.toolbar}>
          <div>
            <h3 style={{ margin: 0, color: colors.text, fontSize: '16px', fontWeight: 600 }}>
              Assigned cases
            </h3>
            <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: '13px' }}>
              Search, filter and open a case.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              aria-label="Search cases"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search seeker name or case id"
              style={styles.input}
            />

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={styles.select}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              aria-label="Sort cases"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              style={styles.select}
            >
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="seekerName-asc">Seeker (A-Z)</option>
              <option value="status-asc">Status</option>
            </select>
          </div>
        </div>

        {error && (
          <div role="alert" style={styles.errorBox}>
            <span>{error}</span>
            <button type="button" onClick={() => loadDashboardData()} style={styles.smallButton}>
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <p style={styles.empty}>Loading your cases...</p>
        ) : paginatedCases.length === 0 ? (
          <div style={styles.empty}>
            <p style={{ margin: '0 0 8px', color: colors.text, fontWeight: 600 }}>
              No cases match what you are looking for.
            </p>
            <p style={{ margin: '0 0 16px', fontSize: '13px' }}>
              Try clearing the search box or choosing a different status.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              style={styles.smallButton}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Seeker</th>
                    <th style={styles.th}>Referred by</th>
                    <th style={styles.th}>Status</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCases.map((caseItem) => (
                    <tr key={caseItem._id}>
                      <td style={styles.td}>
                        <strong>{caseItem.seeker?.name || 'Anonymous seeker'}</strong>
                        {caseItem.seeker?.email && (
                          <span style={{ display: 'block', fontSize: '12px', color: colors.muted }}>
                            {caseItem.seeker.email}
                          </span>
                        )}
                      </td>
                      <td style={{ ...styles.td, color: colors.muted }}>
                        {caseItem.volunteer?.name || 'Not recorded'}
                      </td>
                      <td style={styles.td}>
                        <span style={badgeStyle(caseItem.status)}>{caseItem.status}</span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedCaseModal(caseItem)}
                          style={{ ...styles.smallButton, marginRight: '8px' }}
                        >
                          Quick view
                        </button>
                        <button
                          type="button"
                          onClick={() => openCase(caseItem._id)}
                          style={styles.button}
                        >
                          Open case
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.pager}>
              <span>
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, processedCases.length)} of{' '}
                {processedCases.length} cases
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={styles.smallButton}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={styles.smallButton}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedCaseModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal} role="dialog" aria-label="Case quick view">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${colors.border}`,
                paddingBottom: '12px',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ margin: 0, color: colors.text, fontSize: '16px', fontWeight: 600 }}>
                Case summary
              </h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedCaseModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: colors.muted,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: '13px', color: colors.text }}>
              <p style={{ margin: '0 0 8px' }}>
                <strong>Seeker:</strong> {selectedCaseModal.seeker?.name || 'Anonymous'}
              </p>
              <p style={{ margin: '0 0 8px' }}>
                <strong>Status:</strong>{' '}
                <span style={badgeStyle(selectedCaseModal.status)}>{selectedCaseModal.status}</span>
              </p>
              <div
                style={{
                  backgroundColor: '#f7fafc',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  padding: '12px',
                  marginTop: '12px',
                }}
              >
                <strong style={{ display: 'block', marginBottom: '4px' }}>Handover note</strong>
                <span style={{ color: colors.muted }}>
                  {selectedCaseModal.summary ||
                    selectedCaseModal.handoverSummary ||
                    'No volunteer note provided.'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setSelectedCaseModal(null)}
                style={styles.smallButton}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = selectedCaseModal._id;
                  setSelectedCaseModal(null);
                  openCase(id);
                }}
                style={styles.button}
              >
                Open case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PsychologistDashboard;
