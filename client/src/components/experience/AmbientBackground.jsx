import { useEffect, useRef } from "react";

// The living background behind the public pages.
//
// Three heavily blurred shapes drift on long loops (26-38s), and a pool of
// light follows the pointer. The pointer light is driven by the --me-x and
// --me-y custom properties, which CustomCursor already updates; this component
// also sets them itself so the background still responds on a page where the
// custom cursor is not mounted, and recentres them when the pointer leaves.
//
// It sits behind everything at z-index 0 and never takes pointer events.

export default function AmbientBackground() {
  const rootRef = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const root = document.documentElement;
    let frame = 0;
    let targetX = 50;
    let targetY = 40;
    let x = 50;
    let y = 40;

    const onMove = (e) => {
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
    };

    // when the pointer leaves, drift the light back to a resting position
    // rather than freezing it wherever it happened to be
    const onLeave = () => {
      targetX = 50;
      targetY = 40;
    };

    const tick = () => {
      // much slower than the cursor ring: the light should feel like it is
      // catching up over a second or so, not tracking
      x += (targetX - x) * 0.045;
      y += (targetY - y) * 0.045;
      root.style.setProperty("--me-x", `${x.toFixed(2)}%`);
      root.style.setProperty("--me-y", `${y.toFixed(2)}%`);
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={rootRef} className="me-ambient" aria-hidden="true">
      <span className="me-orb me-orb-1" />
      <span className="me-orb me-orb-2" />
      <span className="me-orb me-orb-3" />
      <span className="me-grain" />
    </div>
  );
}
