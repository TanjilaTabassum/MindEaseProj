import { NavLink } from "react-router-dom";

const linksByRole = {
  seeker: [
    { to: "/dashboard/new-request", label: "Request Help" },
    { to: "/dashboard/workshops", label: "Workshops" },
    { to: "/resources", label: "Resource Library" },
  ],
  facilitator: [
    { to: "/dashboard/my-workshops", label: "My Workshops" },
    { to: "/dashboard/workshops/new", label: "Create Workshop" },
  ],
  admin: [
    { to: "/dashboard/users", label: "Manage Users" },
    { to: "/dashboard/verifications", label: "Verifications" },
    { to: "/dashboard/resources", label: "Resources" },
    { to: "/dashboard/reports", label: "Reports" },
  ],
};

function getStoredUser() {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export default function Sidebar() {
  const user = getStoredUser();
  const role = user?.role || "user";

  const links = [
    { to: "/dashboard", label: "Overview", end: true },
    ...(linksByRole[role] || []),
    { to: "/dashboard/profile", label: "Profile" },
  ];

  return (
    <aside className="sidebar">
      <p className="sidebar-title">{role} menu</p>
      <nav>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}