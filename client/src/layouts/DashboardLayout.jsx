import { Navigate, Outlet } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Sidebar from "../components/common/Sidebar";
import AmbientBackground from "../components/experience/AmbientBackground";
import ParticleField from "../components/experience/ParticleField";
import CustomCursor from "../components/experience/CustomCursor";
import PointerEffects from "../components/experience/PointerEffects";
import "../styles/experience.css";

// Signed-in shell.
//
// Same experience layer as the public side, with `me-app-dashboard` turning
// the background down (see experience.css) so dense tables and forms stay
// readable. No intro overlay here - it belongs to arriving at the site, not
// to every dashboard navigation.

export default function DashboardLayout() {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dashboard-layout me-app me-app-dashboard">
      <AmbientBackground />
      <ParticleField />
      <CustomCursor />
      <PointerEffects />

      <Navbar />
      <div className="dashboard-body">
        <Sidebar />
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
