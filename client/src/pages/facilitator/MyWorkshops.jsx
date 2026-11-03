import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const card = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "1rem",
  marginBottom: "1rem",
  background: "#fff",
};

const badge = (bg, color) => ({
  backgroundColor: bg,
  color,
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  marginLeft: 8,
});

const statusStyle = {
  Scheduled: badge("#c6f6d5", "#22543d"),
  Cancelled: badge("#fed7d7", "#742a2a"),
  Completed: badge("#e2e8f0", "#2d3748"),
};

export default function MyWorkshops() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const load = async () => {
    try {
      const res = await axios.get("/api/workshops/mine", authConfig());
      setWorkshops(Array.isArray(res.data) ? res.data : res.data.workshops || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your workshops.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cancelWorkshop = async (w) => {
    if (!window.confirm(`Cancel "${w.title}"? Enrolled seekers will be notified.`)) return;
    setMessage("");
    setError("");
    try {
      await axios.patch(`/api/workshops/${w._id}/cancel`, {}, authConfig());
      setMessage(`"${w.title}" was cancelled.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel the workshop.");
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>My workshops</h1>
        <Link to="/dashboard/workshops/new">
          <button>Create a workshop</button>
        </Link>
      </div>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && workshops.length === 0 && !error && (
        <p>You have not created any workshops yet.</p>
      )}

      {workshops.map((w) => (
        <div key={w._id} style={card}>
          <strong>{w.title}</strong>
          <span style={statusStyle[w.status] || statusStyle.Completed}>{w.status}</span>
          {w.mode && <span style={badge("#e2e8f0", "#2d3748")}>{w.mode}</span>}
          <span style={badge("#bee3f8", "#2a4365")}>
            {w.price > 0 ? `${w.price} BDT` : "Free"}
          </span>
          <p>{w.description}</p>
          <small>
            {new Date(w.date).toLocaleDateString()}
            {w.time ? ` at ${w.time}` : ""}
            {w.durationMinutes ? `, ${w.durationMinutes} minutes` : ""}
            {" | "}Seats taken: {w.enrolledCount || 0} of {w.capacity}
          </small>
          {w.status === "Scheduled" && (
            <div style={{ marginTop: "0.75rem" }}>
              <button onClick={() => cancelWorkshop(w)}>Cancel workshop</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}