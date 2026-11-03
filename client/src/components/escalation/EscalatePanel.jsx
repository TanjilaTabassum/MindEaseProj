import { useEffect, useState } from "react";
import axios from "axios";

// Props:
//   requestId   - the accepted crisis request to escalate
//   onEscalated - called after the escalation is saved
//
// Uses the existing backend (server/routes/escalationRoutes.js):
//   GET  /api/escalations/psychologists   -> { psychologists: [{ _id, name, email }] }
//   POST /api/escalations { requestId, psychologistId, summary }  (summary: at least 20 characters)
const ESC_BASE = "/api/escalations";
const MIN_SUMMARY = 20;

export default function EscalatePanel({ requestId, onEscalated }) {
  const [psychologists, setPsychologists] = useState([]);
  const [psychologistId, setPsychologistId] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  useEffect(() => {
    axios
      .get(`${ESC_BASE}/psychologists`, authHeader())
      .then((res) => setPsychologists(res.data.psychologists || []))
      .catch((err) =>
        setError(err.response?.data?.message || "Could not load psychologists.")
      )
      .finally(() => setLoading(false));
  }, []);

  const trimmed = summary.trim();
  const canSend = psychologistId && trimmed.length >= MIN_SUMMARY && !saving;

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      await axios.post(
        ESC_BASE,
        { requestId, psychologistId, summary: trimmed },
        authHeader()
      );
      onEscalated && onEscalated();
    } catch (err) {
      setError(err.response?.data?.message || "Could not refer this case. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "520px" }}>
      <h3>Refer to a psychologist</h3>

      {loading && <p>Loading psychologists...</p>}
      {!loading && psychologists.length === 0 && !error && (
        <p>No approved psychologists are available right now.</p>
      )}
      {error && <p style={{ color: "#B91C1C" }}>{error}</p>}

      {psychologists.length > 0 && (
        <>
          <label>
            Psychologist
            <select
              value={psychologistId}
              onChange={(e) => setPsychologistId(e.target.value)}
              style={{ display: "block", marginTop: "4px", marginBottom: "12px" }}
            >
              <option value="">Select a psychologist</option>
              {psychologists.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Summary for the psychologist
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Why does this case need clinical follow-up?"
              style={{ display: "block", width: "100%", marginTop: "4px" }}
            />
          </label>
          <small>
            {trimmed.length}/{MIN_SUMMARY} characters minimum
          </small>

          <div style={{ marginTop: "12px" }}>
            <button type="button" onClick={submit} disabled={!canSend}>
              {saving ? "Sending..." : "Refer to psychologist"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}