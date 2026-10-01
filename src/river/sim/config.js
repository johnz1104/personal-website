import { homeRiver } from "../banks.js";
import { cropBank } from "../geometry.js";

// CSS px per page unit at the page's designed size.
export const PAGE_SCALE = 5 / 6;

// Up to this window size (CSS px) the page keeps its designed size and the window
// crops the river. Above it, text, cards and river scale up together, so every window
// shows at most 1728 x 1080 page units: the river never dominates, and the right bank
// (innermost point x = 1830) never shows. Zooming out stops shrinking the page here.
export const REFERENCE_WINDOW = { width: 1440, height: 900 };

// How much the whole page is scaled up beyond its designed size.
export function pageZoom() {
  const { clientWidth, clientHeight } = document.documentElement;
  return Math.max(1, clientWidth / REFERENCE_WINDOW.width, clientHeight / REFERENCE_WINDOW.height);
}

// The part of the river the window shows, in page units from the top-left corner.
export function windowView() {
  const { clientWidth, clientHeight } = document.documentElement;
  const scale = pageScale();
  return { right: clientWidth / scale, bottom: clientHeight / scale };
}

// CSS px per page unit right now: the river's drawing scale.
export function pageScale() {
  return PAGE_SCALE * pageZoom();
}

// The simulated river: only what a window can show (1728 x 1080 page units, the
// reference window at the page scale), bounded by the left bank. Its flow follows the
// author's drawing (river_flow_diagram.jpeg): water rises from the bottom, gathering
// toward the river's mouth; a side flow enters low on the right edge; the currents
// rise together, the leftmost curls into the upper curve, and all leave at the top.
const pageRiver = Object.freeze({
  width: 1728,
  height: 1080,
  left: cropBank(homeRiver.left, { width: 1728, height: 1080 }),
  right: null,
});

// Settings for each river group, the `home` and `detail` RiverLayouts in App.jsx.
// A group set to null has no river: RiverLayout shows only the page content.
//
// river    the geometry: the banks (right: null for none) and the page's river area
// options  Simulation settings as a key=value list, with the same keys as the native
//          preview (fluids/lbm/include/lbm/RiverOptions.hpp), so a setting tuned in
//          one works in the other. The page's flow (DECISIONS.md, "the drawing"):
//          The author's tuned setting (2026-09-28; speed 50 on 2026-09-30):
//          - The bottom inflow (50 units/s, moderately uneven) converges on a point
//            above the page (1300, -150): up along the bank near it, up-left near
//            the right edge.
//          - A side flow enters the right edge below y 820, level, at 50 units/s;
//            the right edge above it is a wall.
//          - A corner jet: the 250 units of the bottom inflow next to the bank enter at
//            80 units/s, tilted 45 degrees away from the bank; its edge rolls up into
//            a chain of eddies from the bottom-left corner up along the bank.
//          - A weak, broad push (1.2, radius 140) curls water into the upper curve's
//            pocket; gentle random stirring keeps it changing.
//          - Re 100000 (the author; 1000000 was a slip): at cell 10 the Smagorinsky
//            model sets most of the viscosity, so Re 10000 and above look alike.
//          - `bedDrag` only matters with the hidden bed on (`depth=1`); it is off.
//          - A 12-row outlet channel; lattice speed 0.0095 keeps peak Mach below 0.2.
//          Measured with the control box (native, seed 11, 180 s; DECISIONS.md):
//          finite, peak Mach 0.169, density within 1.8%, 474 steps/s.
// look     How the dots are drawn:
//   radius   dot radius in page units
//   fadeIn   seconds over which a new dot fades in
//   buckets  color steps across --color-dot-1, -2, ... (variables.css, darkest first);
//            as many as there are shades gives exactly those, more blends between
//            them; colors: [...] overrides the shades
//   opacity  0..1 (default 1); visible: false hides the dots; trail: seconds a dot's
//            fading streak lasts (0 or absent = no trails)
//   lines    tracer lines: seconds of each dot's recent path drawn behind it, i.e. the
//            ratio of tail length to speed (0 or absent = none; at most about 1);
//            tracers: false hides them and keeps the ratio. Dot and
//            line are one stroke at the dot's color, thickness and opacity; the dots'
//            random jitter is off while lines show, and a dot leaving the view keeps
//            moving until its line has followed it out.
//   delay    seconds the dots wait, once the river is ready, before they appear and
//            move (0 or absent = none; the author: 1, 2026-09-30)
//
// The author sets the values with the dev tuning panel (`npm run dev`, then /?tune).
const RIVER_OPTIONS =
  "cell=10 lattice=0.0095 speed=50 re=100000 stir=1 inflowAmplitude=0.5 inflowFloor=0.6 " +
  "push=1.2 pushRadius=140 side=1 sideTop=820 sideSpeed=50 sideAngle=0 sideOutlet=0 " +
  "cornerJet=250 cornerSpeed=80 cornerAngle=45 converge=1 convergeX=1300 convergeY=-150 " +
  "bedDrag=0.25 outletCells=12";

// The control box ("Flow on/off"; RiverControls.jsx) floats in the river, and the
// simulation gets a solid box in the same place, so the water parts around it and
// sheds eddies. The author asked for a rectangle near the lower right corner that
// catches more of the flow from below than from the side: the water arrives there
// almost straight up (DECISIONS.md, "control box"). It stays inside the smallest views
// it is meant for: 1366 px wide windows (x up to 1639) and 1080p monitor windows (y up to
// 864); smaller or narrower windows move it in (placeControls). Page units; the box
// grows with the controls if more are added.
const RIVER_CONTROLS = Object.freeze({ x: 1500, y: 782, width: 120, height: 48 });

// The box's gaps to the window's right and bottom edges in the author's view (a
// MacBook Air, 1440 x 790 px: 1728 x 948 page units), and the least room (its shadow
// and a little air) for the box to count as fitting where it is.
const CONTROLS_GAP = Object.freeze({ right: 108, bottom: 118 });
const CONTROLS_FIT = 12;

// Where the control box goes in a window showing `view` (windowView()). Each axis keeps
// the author's spot when the box fits there; otherwise the box moves left (or up) to the
// author's gap from that edge. RiverLayout places the box and its obstacle once, when
// the river starts, so small windows (1280 x 720) and narrow ones (1440 x 1000, where
// the zoom follows the height) show it whole.
export function placeControls(box, view) {
  const place = (at, size, edge, gap) =>
    at + size + CONTROLS_FIT <= edge ? at : Math.max(0, Math.min(at, edge - gap - size));
  return {
    ...box,
    x: place(box.x, box.width, view.right, CONTROLS_GAP.right),
    y: place(box.y, box.height, view.bottom, CONTROLS_GAP.bottom),
  };
}

export const riverConfig = {
  home: {
    river: pageRiver,
    options: RIVER_OPTIONS,
    look: { radius: 1.75, fadeIn: 0.5, buckets: 3, lines: 0.65, opacity: 0.5, delay: 1 },
    controls: RIVER_CONTROLS,
  },
  // Detail pages have no river (no bank, dots or controls) until their own is
  // designed (the author, 2026-09-28).
  detail: null,
};

// The options the simulation runs: a group's tuned options plus the control box as a
// solid obstacle (kept out of `options`, so the tuner's copied config stays about the
// flow, and moving the box moves the obstacle with it).
export function simulationOptions(options, controls) {
  if (!controls) return options;
  const { x, y, width, height } = controls;
  return `${options} boxX=${x} boxY=${y} boxW=${width} boxH=${height}`;
}
