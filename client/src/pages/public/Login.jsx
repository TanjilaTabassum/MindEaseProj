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

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      // ADJUST: endpoint path if your authRoutes.js uses something else
      const res = await axios.post("/api/auth/login", form);

      // ADJUST: field names if authController.js returns a different shape
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate(`/dashboard/${user.role}`);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

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
          Welcome back
        </h1>

        {error && (
          <div
            style={{
              background: "#fff5f5",
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

          <label style={{ ...labelStyle, marginBottom: showPasswordError ? 6 : 16 }}>
            Password
            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              onBlur={() => setTouched(true)}
              autoComplete="current-password"
              hasError={showPasswordError}
              style={inputStyle}
            />
          </label>

          {showPasswordError && (
            <p
              role="alert"
              style={{
                margin: "0 0 16px",
                color: colors.error,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Password must be at least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}

          <button type="submit" disabled={loading} style={buttonStyle(loading)}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 14, color: colors.muted, textAlign: "center" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: colors.primary, fontWeight: 600 }}>
            Sign up
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