import { useEffect, useRef } from "react";

// The living background: a canvas of drifting motes and slow leaf shapes that
// react to the pointer.
//
// Three layers at different depths, so moving the pointer produces parallax
// rather than one flat sheet of dots. Depth drives size, speed, opacity and
// how strongly a particle answers the cursor - near things move a lot, far
// things barely at all.
//
// The cursor pushes particles gently away and leaves a wake. It is a soft
// push, not a hard repel: the point is that the background notices you, not
// that it plays with you.

const COUNT_BY_AREA = 0.00011; // particles per px² of viewport
const MAX_PARTICLES = 220;
const MIN_PARTICLES = 70;

function makeParticle(w, h) {
  // depth 0 = far, 1 = near
  const depth = Math.random();
  const isLeaf = Math.random() < 0.22;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    depth,
    r: isLeaf ? 7 + depth * 13 : 1.4 + depth * 3.4,
    isLeaf,
    // slow base drift, upward-ish, faster when near
    vx: (Math.random() - 0.5) * (0.12 + depth * 0.26),
    vy: -(0.09 + Math.random() * 0.16) * (0.4 + depth),
    // offset from the drift, used for the cursor push, always easing back to 0
    ox: 0,
    oy: 0,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.008,
    hue: 92 + Math.random() * 26, // greens
    alpha: 0.2 + depth * 0.45,
    phase: Math.random() * Math.PI * 2,
    sway: 0.3 + Math.random() * 0.8,
  };
}

export default function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles = [];
    let frame = 0;
    let running = true;
    let t = 0;

    // pointer, in canvas space; -1 means "not over the page"
    const pointer = { x: -1, y: -1, px: -1, py: -1, speed: 0 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.round(
        Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, w * h * COUNT_BY_AREA))
      );
      if (particles.length > target) particles.length = target;
      while (particles.length < target) particles.push(makeParticle(w, h));
    };

    const onPointer = (e) => {
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (pointer.px >= 0) {
        const dx = pointer.x - pointer.px;
        const dy = pointer.y - pointer.py;
        pointer.speed = Math.min(Math.hypot(dx, dy), 60);
      }
    };

    const onLeave = () => {
      pointer.x = -1;
      pointer.y = -1;
      pointer.speed = 0;
    };

    const drawLeaf = (p) => {
      // a simple two-arc leaf; cheap and reads as organic at this size
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.quadraticCurveTo(p.r * 0.85, 0, 0, p.r);
      ctx.quadraticCurveTo(-p.r * 0.85, 0, 0, -p.r);
      ctx.closePath();
      ctx.fill();
    };

    const step = () => {
      if (!running) return;
      t += 0.0055;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];

        // base drift plus a slow lateral sway, so nothing travels in a line
        p.x += p.vx + Math.sin(t * p.sway + p.phase) * 0.16 * (0.3 + p.depth);
        p.y += p.vy;
        p.rot += p.vrot;

        // cursor push: near particles feel it most
        if (pointer.x >= 0) {
          const dx = p.x + p.ox - pointer.x;
          const dy = p.y + p.oy - pointer.y;
          const dist2 = dx * dx + dy * dy;
          const radius = 210 + pointer.speed * 3.2;
          if (dist2 < radius * radius && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const force = (1 - dist / radius) ** 2 * (0.35 + p.depth * 1.5);
            p.ox += (dx / dist) * force * 4.2;
            p.oy += (dy / dist) * force * 4.2;
          }
        }

        // always ease the push back out, so the field settles when still
        p.ox *= 0.94;
        p.oy *= 0.94;

        // wrap around the edges
        const margin = p.r + 8;
        if (p.y < -margin) {
          p.y = h + margin;
          p.x = Math.random() * w;
        }
        if (p.x < -margin) p.x = w + margin;
        else if (p.x > w + margin) p.x = -margin;

        const x = p.x + p.ox;
        const y = p.y + p.oy;

        ctx.save();
        ctx.translate(x, y);

        if (p.isLeaf) {
          ctx.rotate(p.rot);
          ctx.fillStyle = `hsla(${p.hue}, 48%, 42%, ${p.alpha * 0.75})`;
          drawLeaf(p);
        } else {
          ctx.fillStyle = `hsla(${p.hue}, 55%, 45%, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      frame = requestAnimationFrame(step);
    };

    const onVisibility = () => {
      // stop burning frames on a hidden tab
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(step);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="me-particles" aria-hidden="true" />;
}
