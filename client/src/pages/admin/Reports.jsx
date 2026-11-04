import React, { useCallback, useEffect, useState } from "react";
import { getAdminSummary, readError } from "../../api/adminApi";

// Admin Reports (demo item 6).
//
// Deliberately the same numbers as the admin overview, from the same
// GET /api/admin/summary (T16.3), laid out as one flat set of totals. It is a
// reporting view of data we already have, not a second source of truth - if
// these ever disagreed with the dashboard, one of them would be lying.

const colors = {
  text: "#2d3748",
  muted: "#718096",
  border: "#e2e8f0",
  panel: "#ffffff",
};

const styles = {
  page: { padding: "24px", maxWidth: "960px", margin: "0 auto" },
  heading: { margin: 0, color: colors.text, fontSize: "24px", fontWeight: 600 },
  sub: { margin: "4px 0 24px", color: colors.muted, fontSize: "14px" },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "28px",
  },
  card: {
    backgroundColor: colors.panel,
    padding: "20px",
    borderRadius: "8px",
    border: `1px solid ${colors.border}`,
  },
  cardLabel: { margin: 0, fontSize: "13px", color: colors.muted },
  cardValue: { margin: "6px 0 4px", fontSize: "28px", fontWeight: 700, color: colors.text },
  cardHint: { margin: 0, fontSize: "13px", color: colors.muted },
  sectionTitle: { margin: "0 0 12px", color: colors.text, fontSize: "16px", fontWeight: 600 },
  button: {
    backgroundColor: "#2f855a",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
  },
};

// A missing bucket shows 0 rather than crashing the page.
const countOf = (obj, key) => (obj && typeof obj[key] === "number" ? obj[key] : 0);
const sumOf = (obj) =>
  obj ? Object.values(obj).reduce((total, n) => total + (typeof n === "number" ? n : 0), 0) : 0;

// The API already computes a total per group (T16.3); summing the buckets is
// only a fallback, so an older response still renders.
const totalOf = (group, buckets) =>
  typeof group?.total === "number" ? group.total : sumOf(buckets);

const humanize = (key) =>
  String(key).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function StatCard({ id, label, value, hint }) {
  return (
    <div style={styles.card} data-testid={`report-${id}`}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={styles.cardValue}>{value}</p>
      {hint && <p style={styles.cardHint}>{hint}</p>}
    </div>
  );
}

function Breakdown({ title, counts = {} }) {
  const entries = Object.entries(counts);
  return (
    <section style={{ marginBottom: "28px" }}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.cards}>
        {entries.length === 0 && <p style={styles.cardHint}>No data yet.</p>}
        {entries.map(([key, n]) => (
          <StatCard key={key} id={`${title}-${key}`} label={humanize(key)} value={n} />
        ))}
      </div>
    </section>
  );
}

export function ReportsView({ summary, onRefresh }) {
  const users = summary?.users || {};
  const requests = summary?.requests || {};
  const workshops = summary?.workshops || {};
  const referrals = summary?.referrals || {};

  return (
    <div style={styles.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={styles.heading}>Reports</h2>
          <p style={styles.sub}>
            The same counts as the admin overview, grouped for reporting.
            {summary?.generatedAt &&
              ` Updated at ${new Date(summary.generatedAt).toLocaleTimeString()}.`}
          </p>
        </div>
        {onRefresh && (
          <button type="button" style={styles.button} onClick={onRefresh}>
            Refresh
          </button>
        )}
      </div>

      <section style={{ marginBottom: "28px" }}>
        <h3 style={styles.sectionTitle}>Totals</h3>
        <div style={styles.cards}>
          <StatCard
            id="users-total"
            label="Users"
            value={totalOf(users, users.byRole)}
            hint={`${countOf(users.byStatus, "pending")} waiting for approval`}
          />
          <StatCard
            id="requests-total"
            label="Crisis requests"
            value={totalOf(requests, requests.byStatus)}
            hint={`${countOf(requests.byStatus, "pending")} still unassigned`}
          />
          <StatCard
            id="workshops-total"
            label="Workshops"
            value={totalOf(workshops, workshops.byStatus)}
            hint={`${countOf(workshops.byStatus, "Scheduled")} scheduled`}
          />
          <StatCard
            id="referrals-total"
            label="NGO referrals"
            value={totalOf(referrals, referrals.byStatus)}
            hint={`${countOf(referrals.byStatus, "pending")} pending`}
          />
        </div>
      </section>

      <Breakdown title="Users by role" counts={users.byRole} />
      <Breakdown title="Users by status" counts={users.byStatus} />
      <Breakdown title="Requests by status" counts={requests.byStatus} />
      <Breakdown title="Workshops by status" counts={workshops.byStatus} />
    </div>
  );
}

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      return await getAdminSummary();
    } catch (err) {
      setError(readError(err, "Could not load the report numbers."));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await load();
      if (active && data) setSummary(data);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const refresh = async () => {
    const data = await load();
    if (data) setSummary(data);
  };

  if (loading && !summary) {
    return (
      <div style={styles.page}>
        <p style={{ color: colors.muted }}>Loading the report...</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div style={styles.page}>
        <h2 style={styles.heading}>Reports</h2>
        <p role="alert" style={{ color: "crimson", fontSize: "14px" }}>
          {error}
        </p>
      </div>
    );
  }

  return <ReportsView summary={summary} onRefresh={refresh} />;
}
