import { useEffect } from "react";

// Two pointer behaviours applied across the whole app, wired once at the root
// rather than per component:
//
//   magnetic  - a button leans toward the pointer as it approaches, within a
//               small radius, and springs back when the pointer leaves.
//   tilt      - a card tips very slightly away from the pointer, which reads
//               as the surface catching light.
//
// Both are capped low on purpose. A button that chases the cursor across the
// screen is a toy; a button that leans 6px is a surface that noticed you.
// Delegated listeners mean pages added later get this for free.

const MAGNET_SELECTOR = [
  ".me-app button:not([disabled])",
  '.me-app a[class*="btn"]',
  ".me-app .navbar-btn",
  ".me-app .navbar-link",
  ".me-app .sidebar-link",
  ".me-app .me-magnetic",
].join(", ");

// `.me-card` and `article` are the components written for this layer; the
// `[style*=...]` selector catches the inline-styled panels on the older
// pages (see theme.css for why that string matches).
const TILT_SELECTOR = [
  ".me-app .me-card",
  ".me-app article",
  '.me-app [style*="background-color: rgb(255, 255, 255)"]',
].join(", ");

const MAGNET_RADIUS = 100;
const MAGNET_MAX = 8; // px
const TILT_MAX = 4.5; // degrees

export default function PointerEffects() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reduced) return undefined;

    // elements we have moved and still need to reset
    const active = new Set();

    // A running CSS animation outranks an inline style, so the float would
    // simply cancel the magnet. Pause the float while an element is being
    // pulled, and let it resume once the pointer moves away.
    const grab = (el, transform) => {
      el.style.animationPlayState = "paused";
      el.style.transform = transform;
      active.add(el);
    };

    const reset = (el) => {
      el.style.transform = "";
      el.style.animationPlayState = "";
      active.delete(el);
    };

    // Re-querying every element on every frame is wasteful; refresh the lists
    // on a timer and when the DOM changes instead.
    let magnetEls = [];
    let tiltEls = [];
    const refresh = () => {
      magnetEls = Array.from(document.querySelectorAll(MAGNET_SELECTOR));
      tiltEls = Array.from(document.querySelectorAll(TILT_SELECTOR));
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });

    const onMove = (e) => {
      const { clientX: px, clientY: py } = e;

      // --- magnetic buttons -------------------------------------------
      magnetEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.hypot(dx, dy);
        const reach = MAGNET_RADIUS + Math.max(r.width, r.height) / 2;

        if (dist < reach) {
          const pull = (1 - dist / reach) * MAGNET_MAX;
          grab(
            el,
            `translate3d(${((dx / dist) || 0) * pull}px, ${((dy / dist) || 0) * pull}px, 0)`
          );
        } else if (active.has(el)) {
          reset(el);
        }
      });

      // --- card tilt ----------------------------------------------------
      tiltEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        const inside =
          px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;

        if (inside) {
          // -1..1 from the centre of the card
          const nx = (px - (r.left + r.width / 2)) / (r.width / 2);
          const ny = (py - (r.top + r.height / 2)) / (r.height / 2);

          // A fixed angle that looks good on a 300px card throws the far edge
          // of a full-width dashboard panel around by tens of pixels, which
          // makes a form inside it feel like it is sliding away. Scale the
          // angle down as the surface gets bigger.
          const amount =
            TILT_MAX * Math.min(1, 460 / Math.max(r.width, r.height, 1));

          grab(
            el,
            `perspective(1100px) rotateX(${(-ny * amount).toFixed(2)}deg) ` +
              `rotateY(${(nx * amount).toFixed(2)}deg) translate3d(0,-5px,0)`
          );
        } else if (active.has(el)) {
          reset(el);
        }
      });
    };

    const onLeave = () => {
      Array.from(active).forEach(reset);
      active.clear();
    };

    // rAF-throttled, so a fast mouse does not queue up layout reads
    let queued = false;
    let lastEvent = null;
    const throttled = (e) => {
      lastEvent = e;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (lastEvent) onMove(lastEvent);
      });
    };

    window.addEventListener("pointermove", throttled, { passive: true });
    document.addEventListener("mouseleave", onLeave);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", throttled);
      document.removeEventListener("mouseleave", onLeave);
      onLeave();
    };
  }, []);

  return null;
}
