import { useState, useSyncExternalStore } from "react";
import { Outlet, useParams } from "react-router-dom";
import RiverBank from "./RiverBank.jsx";
import RiverControls from "./RiverControls.jsx";
import RiverDots from "./RiverDots.jsx";
import {
  PAGE_SCALE,
  pageZoom,
  placeControls,
  riverConfig,
  windowView,
} from "../river/sim/config.js";
import { useRiverPlaying } from "../river/sim/useRiverSimulation.js";

// Page content is laid out for a 1200 x 750 display: 1440 x 900 page units at the
// designed page scale. The river behind it is bigger than any screen and fills the
// window. Up to the reference window the window crops it; above that, content and
// river scale up together (pageZoom), so there is nothing to scroll to.
const CONTENT_WIDTH = 1440 * PAGE_SCALE;

function subscribeResize(onChange) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function windowSize() {
  const { clientWidth, clientHeight } = document.documentElement;
  return `${clientWidth}x${clientHeight}`;
}

// One stretch of river shared by every page routed inside this layout.
// Navigating between those pages swaps only the <Outlet /> content; the river
// stays mounted, so the flow and its dots carry on. Opening a page under a
// different RiverLayout (a different `key` in App.jsx) starts a new river.
// The river comes from config.js; the `bank` prop App.jsx passes is not used.
function RiverLayout() {
  // Detail pages have a :slug. React Router shares one params object across the
  // matched routes, so this layout sees its child's slug. The group cannot change
  // while the layout is mounted: crossing groups mounts a new layout.
  const { slug } = useParams();
  const group = slug === undefined ? "home" : "detail";
  const config = riverConfig[group];
  const zoom = useSyncExternalStore(subscribeResize, pageZoom);
  // Re-renders on every resize, so the Flow box below can follow the window.
  useSyncExternalStore(subscribeResize, windowSize);
  const scale = PAGE_SCALE * zoom;
  const [playing, togglePlaying] = useRiverPlaying();
  // The Flow box and its obstacle in the water are placed once, for the window the
  // river starts in: the author's spot, or moved in if the window cannot show it.
  const [controls] = useState(
    () => config?.controls && placeControls(config.controls, windowView()),
  );
  // A window made smaller later draws the box inside it, off its obstacle, so the
  // toggle stays in reach.
  const shownControls = controls && placeControls(controls, windowView());
  // A group without a river (config null) keeps the same page layout and zoom.
  const content = (
    // CSS zoom scales the content's layout, text and hit areas together.
    <div className="river-content" style={{ zoom }}>
      <Outlet />
    </div>
  );
  if (!config) {
    return (
      <div className="river-canvas" style={{ "--canvas-width": `${CONTENT_WIDTH}px` }}>
        {content}
      </div>
    );
  }
  return (
    <div
      className="river-canvas"
      style={{
        "--canvas-width": `${CONTENT_WIDTH}px`,
        "--river-width": `${config.river.width * scale}px`,
        "--river-height": `${config.river.height * scale}px`,
      }}
    >
      <RiverDots
        river={config.river}
        group={group}
        config={config}
        controls={controls}
        playing={playing}
      />
      {content}
      <RiverBank river={config.river} />
      {shownControls && (
        <RiverControls
          box={shownControls}
          scale={scale}
          playing={playing}
          onToggle={togglePlaying}
        />
      )}
    </div>
  );
}

export default RiverLayout;
