import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// The opening sequence.
//
// Three aurora fields drift behind a field of rising motes; the mark arrives
// out of a blur into a breathing halo; three rings expand out of it; the
// wordmark rises a letter at a time and a light travels across it once; a
// hairline fills; then the whole screen brightens, blurs and scales past the
// viewer onto the home page.
//
// Three deliberate constraints, because this runs in front of a live demo:
//   - it plays once per browser session, so navigating back to the home page
//     mid-demo does not replay it;
//   - it is skippable, by the button, by Escape, or by clicking anywhere;
//   - someone who asked for reduced motion never sees it at all.
//
// Total runtime is about 3.4s, which is long enough to land and short enough
// that nobody is waiting on it.

const SESSION_KEY = "mindease:intro-seen";
const HOLD_MS = 3400;
const LEAVE_MS = 1000;

const WORD = "MindEase";
const MOTE_COUNT = 18;

export default function IntroOverlay({ onDone }) {
  const { pathname } = useLocation();

  // The intro belongs to arriving at the site, so it plays on the home page
  // only. Someone who follows a link straight to /login or /register wants to
  // sign in, and an overlay sitting over the form for three seconds - which it
  // did - is just an obstacle.
  const isEntry = pathname === "/";

  // Decide synchronously, before first paint, so the page underneath is never
  // briefly visible before the overlay covers it.
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.location.pathname !== "/") return false;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      return sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      return false; // storage blocked: skip rather than replay on every view
    }
  });

  const [leaving, setLeaving] = useState(false);
  const timers = useRef([]);

  // Scattered once, not per render, so the motes do not jump on a re-render.
  const motes = useMemo(
    () =>
      Array.from({ length: MOTE_COUNT }, (_, i) => {
        const size = 3 + Math.random() * 9;
        return {
          key: i,
          left: `${Math.random() * 100}%`,
          width: `${size}px`,
          height: `${size}px`,
          animationDuration: `${7 + Math.random() * 9}s`,
          animationDelay: `${-Math.random() * 10}s`,
          opacity: 0.25 + Math.random() * 0.5,
        };
      }),
    []
  );

  // The overlay only holds the page still while it is both playing and on the
  // route it belongs to. Leaving either condition out of this is what froze
  // the page's scroll; see the note on the effect below.
  const active = show && isEntry;

  // `finish` has to be stable. When it closed over `leaving` its identity
  // changed the moment it ran, which re-ran the effect below - and that
  // effect's cleanup clears every pending timer, including the one `finish`
  // had just set to unmount the overlay. So the overlay never unmounted, the
  // effect never cleaned up, and `body { overflow: hidden }` stayed on: the
  // home page looked finished but would not scroll. Walking to the dashboard
  // unmounted the component and released it, which is why scrolling started
  // working after a round trip.
  const leavingRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* storage blocked; the overlay still closes */
    }
    const t = setTimeout(() => {
      setShow(false);
      if (onDoneRef.current) onDoneRef.current();
    }, LEAVE_MS);
    timers.current.push(t);
  }, []);

  useEffect(() => {
    if (!active) {
      // The second path to the same frozen scroll: someone who clicked a nav
      // link during the intro left the home route, so this rendered nothing -
      // but `show` was still true, so the effect never tore down and the
      // About page inherited a locked body. Keying on `active` covers it.
      if (onDoneRef.current) onDoneRef.current();
      return undefined;
    }

    // hold the page still while the intro plays
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const auto = setTimeout(finish, HOLD_MS);
    timers.current.push(auto);

    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [active, finish]);

  // Belt and braces: whatever happens above, an unmounting overlay never
  // leaves the page unable to scroll. Only undoes our own lock, so it cannot
  // unlock a modal that put the body into the same state for its own reasons.
  useEffect(
    () => () => {
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = "";
      }
    },
    []
  );

  if (!active) return null;

  return (
    <div
      className={`me-intro${leaving ? " is-leaving" : ""}`}
      role="status"
      aria-label="MindEase is loading"
      onClick={finish}
    >
      <span className="me-intro-aurora" aria-hidden="true" />
      <span className="me-intro-aurora" aria-hidden="true" />
      <span className="me-intro-aurora" aria-hidden="true" />

      {motes.map(({ key, ...style }) => (
        <span key={key} className="me-intro-mote" style={style} aria-hidden="true" />
      ))}

      <div className="me-intro-logo-wrap">
        <span className="me-intro-halo" aria-hidden="true" />
        <span className="me-intro-ring" aria-hidden="true" />
        <span className="me-intro-ring" aria-hidden="true" />
        <span className="me-intro-ring" aria-hidden="true" />
        <img
          src="/mindease-logo.png"
          alt=""
          className="me-intro-logo"
          width="160"
          height="160"
        />
      </div>

      <div className="me-intro-word" aria-hidden="true">
        {WORD.split("").map((letter, i) => (
          <span key={`${letter}-${i}`} style={{ animationDelay: `${0.9 + i * 0.07}s` }}>
            {letter}
          </span>
        ))}
      </div>

      <p className="me-intro-tagline">A quiet place to begin</p>

      <div className="me-intro-bar" aria-hidden="true">
        <i />
      </div>

      <button
        type="button"
        className="me-intro-skip"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
      >
        Skip
      </button>
    </div>
  );
}
