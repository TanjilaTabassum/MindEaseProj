import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <Link to="/" className="footer-brand">
          <img src="/mindease-logo.png" alt="" width="26" height="26" />
          <span>MindEase</span>
        </Link>

        <nav className="footer-links">
          <Link to="/about">About</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/login">Log in</Link>
        </nav>
      </div>

      <p className="footer-note">
        © {year} MindEase. Mental health support, Bangladesh.
      </p>
    </footer>
  );
}
