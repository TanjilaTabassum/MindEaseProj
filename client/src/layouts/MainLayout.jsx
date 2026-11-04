import { Outlet } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
import CustomCursor from "../components/experience/CustomCursor";
import AmbientBackground from "../components/experience/AmbientBackground";
import ParticleField from "../components/experience/ParticleField";
import PointerEffects from "../components/experience/PointerEffects";
import IntroOverlay from "../components/experience/IntroOverlay";
import "../styles/experience.css";

// Public shell: the full experience layer.
//
// `me-app` turns on the site-wide float and pointer behaviour; `me-public`
// adds the treatments that only suit the marketing pages (glass navbar, the
// bigger ambient).

export default function MainLayout() {
  return (
    <div className="main-layout me-app me-public">
      <AmbientBackground />
      <ParticleField />
      <CustomCursor />
      <PointerEffects />
      <IntroOverlay />

      <Navbar />
      <main className="main-content" style={{ position: "relative", zIndex: 1 }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
