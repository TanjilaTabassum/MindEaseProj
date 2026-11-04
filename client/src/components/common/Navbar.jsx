import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import "./Navbar.css";

function getStoredUser() {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export default function Navbar() {
  const navigate = useNavigate();
  const user = getStoredUser();

  // Once the page has moved at all the bar tightens and lifts off the
  // content (see `.is-scrolled` in theme.css). Reading scrollY inside a
  // rAF keeps this off the scroll handler's critical path.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setScrolled(window.scrollY > 12);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    isActive ? "navbar-link active" : "navbar-link";

  return (
    <nav className={scrolled ? "navbar is-scrolled" : "navbar"}>
      <Link to="/" className="navbar-brand">
        <img
          src="/mindease-logo.png"
          alt=""
          className="navbar-logo"
          width="30"
          height="30"
        />
        <span>MindEase</span>
      </Link>

      <div className="navbar-links">
        <NavLink to="/" end className={linkClass}>
          Home
        </NavLink>
        <NavLink to="/about" className={linkClass}>
          About
        </NavLink>

        {user ? (
          <>
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
            {/* T15.7 - only signed-in users have notifications */}
            <NotificationBell />
            <span className="navbar-user">Hi, {user.name}</span>
            <button onClick={handleLogout} className="navbar-btn">
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={linkClass}>
              Login
            </NavLink>
            <Link to="/register" className="navbar-btn">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}