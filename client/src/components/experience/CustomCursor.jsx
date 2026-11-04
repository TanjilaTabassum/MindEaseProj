import { useEffect, useRef } from "react";

// A two-part cursor: a small dot that tracks the pointer exactly, and a larger
// ring that eases toward it a frame behind.
//
// The lag is the whole point. A ring that tracked perfectly would feel like a
// bigger mouse pointer; one that trails slightly feels unhurried, which is the
// tone the rest of the page is going for.
//
// Nothing renders for touch devices or for someone who asked for reduced
// motion - in both cases the real cursor is left alone.

const HOVER_SELECTOR =
  'a, button, [role="button"], input, select, textarea, label, summary, .me-hoverable';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return undefined;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return undefined;

    document.body.classList.add("me-cursor-active");

    // target = where the pointer is; ring = where the ring has eased to
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let frame = 0;
    let seen = false;

    const onMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;

      if (!seen) {
        // jump both to the first known position, so nothing flies in from the
        // middle of the screen on the first movement
        seen = true;
        ringX = targetX;
        ringY = targetY;
        dot.classList.remove("is-hidden");
        ring.classList.remove("is-hidden");
      }

      // the ambient layer reads these to move its light toward the pointer
      const root = document.documentElement;
      root.style.setProperty("--me-x", `${(targetX / window.innerWidth) * 100}%`);
      root.style.setProperty("--me-y", `${(targetY / window.innerHeight) * 100}%`);
    };

    const tick = () => {
      // ease the ring toward the pointer; 0.16 is slow enough to read as drag
      ringX += (targetX - ringX) * 0.16;
      ringY += (targetY - ringY) * 0.16;

      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

      frame = requestAnimationFrame(tick);
    };

    const setHover = (on) => {
      dot.classList.toggle("is-hover", on);
      ring.classList.toggle("is-hover", on);
    };

    const onOver = (e) => {
      const el = e.target instanceof Element ? e.target.closest(HOVER_SELECTOR) : null;
      setHover(Boolean(el));
    };

    const onDown = () => ring.classList.add("is-down");
    const onUp = () => ring.classList.remove("is-down");

    const hide = () => {
      dot.classList.add("is-hidden");
      ring.classList.add("is-hidden");
    };
    const show = () => {
      if (!seen) return;
      dot.classList.remove("is-hidden");
      ring.classList.remove("is-hidden");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseleave", hide);
    document.addEventListener("mouseenter", show);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", hide);
      document.removeEventListener("mouseenter", show);
      document.body.classList.remove("me-cursor-active");
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="me-cursor-ring is-hidden" aria-hidden="true" />
      <div ref={dotRef} className="me-cursor-dot is-hidden" aria-hidden="true" />
    </>
  );
}
