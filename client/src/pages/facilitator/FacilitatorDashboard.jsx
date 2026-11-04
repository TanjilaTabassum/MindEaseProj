
import { Link } from "react-router-dom";

const colors = {
  primary: "#2f855a",
  primaryLight: "#c6f6d5",
  white: "#ffffff",
  text: "#2d3748",
  muted: "#718096",
  border: "#e5e7eb",
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
}

export default function FacilitatorDashboard() {
  const user = getStoredUser();
  const isPending = user.status === "pending";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <p style={{ margin: 0, color: colors.primary, fontWeight: 600, fontSize: 14 }}>
        Facilitator dashboard
      </p>
      <h1 style={{ margin: "4px 0 8px", color: colors.text, fontSize: 28 }}>
        Plan and run your support groups.
      </h1>
      <p style={{ margin: "0 0 24px", color: colors.muted, fontSize: 15 }}>
        Create and manage your workshops from here or from the menu on the left.
      </p>

      {isPending && (
        <div
          style={{
            background: colors.primaryLight,
            border: `1px solid ${colors.primary}`,
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            color: colors.text,
            fontSize: 14,
          }}
        >
          Your account must be approved by an admin before you can host groups.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 6px", color: colors.text }}>Create a workshop</h3>
          <p style={{ margin: "0 0 16px", color: colors.muted, fontSize: 14 }}>
            Set the topic, date, seats and price. Choose online or in person.
          </p>
          <Link to="/dashboard/workshops/new" style={buttonStyle}>
            Create workshop
          </Link>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 6px", color: colors.text }}>My workshops</h3>
          <p style={{ margin: "0 0 16px", color: colors.muted, fontSize: 14 }}>
            See your workshops, seats left and status. Cancel a workshop if
            needed.
          </p>
          <Link to="/dashboard/my-workshops" style={buttonStyle}>
            View my workshops
          </Link>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: "20px",
};

const buttonStyle = {
  display: "inline-block",
  background: colors.primary,
  color: colors.white,
  padding: "10px 16px",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
};