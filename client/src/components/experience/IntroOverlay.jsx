import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// The opening sequence.
//
// Three aurora fields drift behind a field of rising motes; the mark arrives
// out of a blur into a breathing halo; three rings expand out of it; the
// wordmark rises a letter at a time and a light travels across it once; a
// hairline fills.
//
// Then the handoff. Rather than dissolving, the mark and the name fly from
// the middle of the screen into the top-left and land on the navbar brand -
// so the opening does not end, it becomes the site's own logo. That is a FLIP
// (First, Last, Invert, Play): the lockup is moved onto the navbar by
// position, both halves are measured before and after, each is inverted back
// to where it was, and then released. The browser animates one transform per
// element on the compositor, which is why a 160px mark can shrink to 30px
// across the screen without the page dropping frames.
//
// Three deliberate constraints, because this runs in front of a live demo:
//   - it plays once per browser session, so navigating back to the home page
//     mid-demo does not replay it;
//   - it is skippable, by the button, by Escape, or by clicking anywhere;
//   - someone who asked for reduced motion never sees it at all.
//
// About 4s from load to landing, and the page underneath is clickable from
// the moment the mark starts to leave.

const SESSION_KEY = "mindease:intro-seen";
const HOLD_MS = 2800; // the opening, before anything starts to leave
const GATHER_MS = 380; // clearing everything but the mark and the name
const FLY_MS = 820; // the flight to the navbar
const HANDOVER_MS = 540; // into the flight, when the real brand fades back in

const WORD = "MindEase";
const MOTE_COUNT = 18;
// Leaves promptly, settles slowly. The first curve tried here was slow at
// both ends, so the mark sat still for about 200ms over a page that had
// already been revealed - which read as a freeze, not as a departure.
const FLY_EASE = "cubic-bezier(0.3, 0.6, 0.2, 1)";

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

  // "" | "gathering" | "flying" | "landing" | "leaving" (the fallback exit)
  const [phase, setPhase] = useState("");

  const active = show && isEntry;

  const stageRef = useRef(null);
  const logoRef = useRef(null);
  const wordRef = useRef(null);
  const timers = useRef([]);

  // `finish` has to be stable. When it closed over its own state, calling it
  // changed the callback's identity, which re-ran the effect below - and that
  // effect's cleanup clears every pending timer, including the ones `finish`
  // had just set. The overlay then never unmounted and never released the
  // page's scroll.
  const leavingRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

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

  const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));

  // Move the lockup onto the navbar and play it there from where it stands.
  const flyToBrand = useCallback(() => {
    const stage = stageRef.current;
    const logo = logoRef.current;
    const word = wordRef.current;
    const brand = document.querySelector(".navbar-logo");

    // Nothing to fly to - fall back to the plain dissolve.
    if (!stage || !logo || !word || !brand) {
      setPhase("leaving");
      at(FLY_MS, () => setShow(false));
      return;
    }

    const parts = [logo, word];
    const first = parts.map((el) => el.getBoundingClientRect());

    // Last: dock the stage onto the navbar's own rect and let it relayout.
    const target = brand.getBoundingClientRect();
    stage.style.left = `${target.left}px`;
    stage.style.top = `${target.top}px`;
    stage.classList.add("is-docked");
    const last = parts.map((el) => el.getBoundingClientRect());

    // Invert: put each half back where it was, with no transition.
    parts.forEach((el, i) => {
      const f = first[i];
      const l = last[i];
      // The mark is square, so width is its honest ratio. The wordmark also
      // loses its uppercase and most of its letter-spacing, so its width
      // ratio would be a lie; height tracks the font size instead, and the
      // letters close up over the flight, which is the nicer reading anyway.
      const scale = i === 0 ? f.width / l.width : f.height / l.height;
      el.style.transition = "none";
      el.style.transformOrigin = "center";
      el.style.transform =
        `translate(${f.left + f.width / 2 - (l.left + l.width / 2)}px, ` +
        `${f.top + f.height / 2 - (l.top + l.height / 2)}px) scale(${scale})`;
    });

    // Play: two frames later, so the inverted position is actually painted
    // before the transition is attached - otherwise the browser coalesces
    // both styles and nothing moves.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        parts.forEach((el) => {
          el.style.transition = `transform ${FLY_MS}ms ${FLY_EASE}`;
          el.style.transform = "";
        });
        setPhase("flying");

        // the real navbar brand comes back under the arriving mark
        at(HANDOVER_MS, () => document.body.classList.remove("me-intro-running"));
        at(FLY_MS - 240, () => setPhase("landing"));
        at(FLY_MS, () => {
          setShow(false);
          if (onDoneRef.current) onDoneRef.current();
        });
      })
    );
  }, []);

  const finish = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* storage blocked; the overlay still closes */
    }

    // Hand the page back straight away - the mark is still in flight, but
    // there is no reason to keep the visitor from scrolling or clicking.
    document.body.style.overflow = "";

    setPhase("gathering");
    at(GATHER_MS, flyToBrand);
  }, [flyToBrand]);

  useEffect(() => {
    if (!active) {
      // Someone who clicked a nav link during the intro has left the home
      // route, so this renders nothing - but `show` is still true. Keying on
      // `active` makes sure the teardown below still runs.
      document.body.classList.remove("me-intro-running");
      if (onDoneRef.current) onDoneRef.current();
      return undefined;
    }

    // hold the page still, and the navbar's own brand back, while it plays
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("me-intro-running");

    at(HOLD_MS, finish);

    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("me-intro-running");
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, finish]);

  // Belt and braces: whatever happens above, an unmounting overlay never
  // leaves the page unable to scroll, or the navbar without its logo.
  useEffect(
    () => () => {
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = "";
      }
      document.body.classList.remove("me-intro-running");
    },
    []
  );

  if (!active) return null;

  // The phases accumulate rather than replace each other. Swapping the class
  // outright would drop `is-flying` the moment `is-landing` arrived, and the
  // drained backdrop would flash back in for the last quarter second.
  const order = ["gathering", "flying", "landing"];
  const reached = order.indexOf(phase);
  const classes = ["me-intro"]
    .concat(phase === "leaving" ? ["is-leaving"] : [])
    .concat(reached >= 0 ? order.slice(0, reached + 1).map((p) => `is-${p}`) : [])
    .join(" ");

  return (
    <div
      className={classes}
      role="status"
      aria-label="MindEase is loading"
      onClick={finish}
    >
      <span className="me-intro-aurora" aria-hidden="true" />
      <span className="me-intro-aurora" aria-hidden="true" />
      <span className="me-intro-aurora" aria-hidden="true" />

      {/* grouped so there is one un-animated element to fade; the motes drive
          their own opacity as they rise, and an animation outranks a plain
          `opacity: 0` on the element itself */}
      <div className="me-intro-motes" aria-hidden="true">
        {motes.map(({ key, ...style }) => (
          <span key={key} className="me-intro-mote" style={style} />
        ))}
      </div>

      <div className="me-intro-stage" ref={stageRef}>
        <div className="me-intro-logo-wrap" ref={logoRef}>
          {/* same again: the halo breathes and the rings expand, so the
              wrapper is what the landing fades out */}
          <span className="me-intro-aura" aria-hidden="true">
            <span className="me-intro-halo" />
            <span className="me-intro-ring" />
            <span className="me-intro-ring" />
            <span className="me-intro-ring" />
          </span>
          <img src="/mindease-logo.png" alt="" className="me-intro-logo" />
        </div>

        <div className="me-intro-word" ref={wordRef} aria-hidden="true">
          {WORD.split("").map((letter, i) => (
            <span key={`${letter}-${i}`} style={{ animationDelay: `${0.9 + i * 0.07}s` }}>
              {letter}
            </span>
          ))}
        </div>
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
