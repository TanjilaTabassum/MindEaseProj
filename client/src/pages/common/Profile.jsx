import React, { useEffect, useState } from "react";
import axios from "axios";

// Read-only profile for every role (demo item 5).
//
// One page, not six: the fields below come from the User model, and the
// role-specific part is a short line of context plus whatever extra fields
// that role actually has. Nothing here is editable - editing accounts is not
// in this sprint, and a form that cannot save would be worse than no form.

const colors = {
  text: "#2d3748",
  muted: "#718096",
  border: "#e2e8f0",
  panel: "#ffffff",
};

const styles = {
  page: { padding: "24px", maxWidth: "720px", margin: "0 auto" },
  heading: { margin: 0, color: colors.text, fontSize: "24px", fontWeight: 600 },
  sub: { margin: "4px 0 24px", color: colors.muted, fontSize: "14px" },
  card: {
    backgroundColor: colors.panel,
    padding: "24px",
    borderRadius: "8px",
    border: `1px solid ${colors.border}`,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    padding: "12px 0",
    borderBottom: `1px solid ${colors.border}`,
  },
  label: { color: colors.muted, fontSize: "13px" },
  value: { color: colors.text, fontSize: "14px", fontWeight: 600, textAlign: "right" },
  note: { color: colors.muted, fontSize: "13px", margin: "16px 0 0" },
};

// What each role is told about their own account. Keeps the page useful
// without pretending there is more data than the model holds.
const ROLE_BLURB = {
  seeker: "You can raise a crisis request, chat with a volunteer and join workshops.",
  volunteer: "You can accept crisis requests, refer them to an NGO and escalate to a psychologist.",
  psychologist: "You can accept escalated cases, write private notes and hold video consultations.",
  ngo: "You can see referrals sent to your organisation and update their status.",
  facilitator: "You can create workshops, set a price and run online sessions.",
  admin: "You can verify accounts, manage users and maintain the resource library.",
};

const STATUS_NOTE = {
  pending: "Your account is waiting for an admin to approve it. Some actions stay locked until then.",
  approved: "Your account is approved and active.",
  rejected: "Your account was not approved. Contact an admin if you think this is wrong.",
  suspended: "Your account is suspended. Contact an admin.",
};

const STATUS_COLOR = {
  approved: "#22543d",
  pending: "#975a16",
  rejected: "#9b2c2c",
  suspended: "#9b2c2c",
};

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : null;

function Row({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{value}</span>
    </div>
  );
}

export function ProfileView({ user }) {
  const role = user?.role || "";
  const status = user?.status || "";

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>My profile</h2>
      <p style={styles.sub}>{ROLE_BLURB[role] || "Your MindEase account."}</p>

      <div style={styles.card}>
        <Row label="Name" value={user?.name} />
        <Row label="Email" value={user?.email} />
        <Row label="Phone" value={user?.phone} />
        <Row label="Role" value={titleCase(role)} />
        <div style={styles.row}>
          <span style={styles.label}>Status</span>
          <span style={{ ...styles.value, color: STATUS_COLOR[status] || colors.text }}>
            {titleCase(status)}
          </span>
        </div>
        <Row label="Member since" value={formatDate(user?.createdAt)} />

        {/* only shown when the account actually went through verification */}
        <Row label="Approved on" value={formatDate(user?.verifiedAt)} />
        <Row label="Reason given" value={user?.rejectionReason || user?.suspensionReason} />

        {status && <p style={styles.note}>{STATUS_NOTE[status]}</p>}
      </div>

      <p style={styles.note}>
        This page is read-only. To change any of these details, ask an admin.
      </p>
    </div>
  );
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get("/api/auth/me", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (active) setUser(res.data.user || res.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.message || "Could not load your profile.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: colors.muted }}>Loading your profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <h2 style={styles.heading}>My profile</h2>
        <p role="alert" style={{ color: "crimson", fontSize: "14px" }}>
          {error}
        </p>
      </div>
    );
  }

  return <ProfileView user={user} />;
}
