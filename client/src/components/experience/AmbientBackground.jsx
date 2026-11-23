// The living background behind the public pages.
//
// Three heavily blurred shapes drift on long loops (26-38s). The light pool
// rests at the --me-x / --me-y defaults from experience.css and does not follow
// the pointer, so the mouse cursor behaves like a normal desktop cursor.
//
// It sits behind everything at z-index 0 and never takes pointer events.

export default function AmbientBackground() {
  return (
    <div className="me-ambient" aria-hidden="true">
      <span className="me-orb me-orb-1" />
      <span className="me-orb me-orb-2" />
      <span className="me-orb me-orb-3" />
      <span className="me-grain" />
    </div>
  );
}
