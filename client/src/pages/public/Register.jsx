import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import PasswordInput from "../../components/PasswordInput";

const colors = {
  primary: "#2f855a",
  primaryLight: "#c6f6d5",
  white: "#ffffff",
  bg: "#f7faf8",
  text: "#2d3748",
  muted: "#718096",
  border: "#e5e7eb",
  error: "#c53030",
};

const MIN_PASSWORD_LENGTH = 8;

// Roles a person can self-register as. Admin accounts are created
// separately, not through this form.
const ROLES = [
  { value: "seeker", label: "Seeker" },
  { value: "volunteer", label: "Volunteer" },
  { value: "psychologist", label: "Psychologist" },
  { value: "ngo", label: "NGO" },
  { value: "facilitator", label: "Facilitator" },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "seeker",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const passwordTooShort = form.password.length < MIN_PASSWORD_LENGTH;
  const showPasswordError = (touched || submitted) && passwordTooShort;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitted(true);

    if (passwordTooShort) return;

    setLoading(true);
    try {
      const res = await axios.post("/api/auth/register", form);
      const { token, user } = res.data;

      if (token && user) {
        // Approved account (seeker): log in straight away.
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        navigate(`/dashboard/${user.role}`);
      } else {
        // Pending account (volunteer, psychologist, NGO, facilitator):
        // no token until an admin approves. Clear any old login.
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setPendingApproval(true);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (pendingApproval) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: colors.white,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            padding: "32px 28px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, color: colors.primary, fontWeight: 600, fontSize: 14 }}>
            MindEase
          </p>
          <h1 style={{ margin: "4px 0 16px", color: colors.text, fontSize: 24 }}>
            Account created
          </h1>
          <div
            style={{
              background: colors.primaryLight,
              borderRadius: 6,
              padding: "12px 14px",
              marginBottom: 20,
              color: colors.text,
              fontSize: 14,
            }}
          >
            Your account is waiting for admin approval. You can log in once it
            has been approved.
          </div>
          <Link
            to="/login"
            style={{ color: colors.primary, fontWeight: 600, fontSize: 15 }}
          >
            Go to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* me-card opts the panel into the site-wide float and pointer tilt */}
      <div
        className="me-card"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(255, 255, 255, 0.55)",
          backdropFilter: "blur(20px) saturate(1.3)",
          WebkitBackdropFilter: "blur(20px) saturate(1.3)",
          border: "1px solid rgba(47, 107, 58, 0.14)",
          boxShadow: "0 28px 64px -34px rgba(32, 72, 44, 0.6)",
          borderRadius: 20,
          padding: "36px 30px",
        }}
      >
        <p style={{ margin: 0, color: colors.primary, fontWeight: 600, fontSize: 14 }}>
          MindEase
        </p>
        <h1 style={{ margin: "4px 0 24px", color: colors.text, fontSize: 24 }}>
          Create your account
        </h1>

        {error && (
          <div
            style={{
              background: "#FDEDEE",
              border: `1px solid ${colors.error}`,
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 16,
              color: colors.error,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Full name
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: 6 }}>
            Password
            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              onBlur={() => setTouched(true)}
              autoComplete="new-password"
              hasError={showPasswordError}
              style={inputStyle}
            />
          </label>

          <p
            role={showPasswordError ? "alert" : undefined}
            style={{
              margin: "0 0 16px",
              color: showPasswordError ? colors.error : colors.muted,
              fontSize: 13,
              fontWeight: showPasswordError ? 500 : 400,
            }}
          >
            {showPasswordError
              ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
              : `Use at least ${MIN_PASSWORD_LENGTH} characters.`}
          </p>

          <label style={labelStyle}>
            I am registering as
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              style={inputStyle}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={loading} style={buttonStyle(loading)}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 14, color: colors.muted, textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: colors.primary, fontWeight: 600 }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: 16,
  color: colors.text,
  fontSize: 14,
  fontWeight: 500,
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  fontSize: 15,
  color: colors.text,
  boxSizing: "border-box",
};

function buttonStyle(loading) {
  return {
    width: "100%",
    padding: "12px",
    marginTop: 4,
    background: loading ? colors.primaryLight : colors.primary,
    color: loading ? colors.primary : colors.white,
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    fontWeight: 600,
    cursor: loading ? "default" : "pointer",
  };
}