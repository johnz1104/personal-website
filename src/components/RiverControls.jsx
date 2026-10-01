// The control box that floats in the river: for now one toggle, "Flow on" or "Flow
// off". It
// sits on a solid box in the simulation (config.js, `controls`), so the water parts
// around it. Positioned and sized in page units, like the river, so it stays on its
// obstacle when the window grows; RiverLayout moves it in when the window cannot show
// it (placeControls in config.js). More controls (or a link to how the river works) can
// go in the box later; growing the box grows the obstacle with it.
function RiverControls({ box, scale, playing, onToggle }) {
  const size = { width: box.width * scale, height: box.height * scale };
  return (
    <div
      className="river-controls"
      style={{
        left: box.x * scale,
        top: box.y * scale,
        ...size,
        fontSize: size.height * 0.36,
      }}
    >
      <button
        type="button"
        className="river-controls-toggle"
        aria-pressed={playing}
        onClick={onToggle}
      >
        <span>Flow</span>
        <span className="river-controls-state" aria-hidden="true">{playing ? "on" : "off"}</span>
      </button>
    </div>
  );
}

export default RiverControls;
