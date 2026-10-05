import { homeRiver } from "../banks.js";
import { detailRivers } from "../detailRivers.js";
import { cropBank, evaluateBank } from "../geometry.js";

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

// Settings for each river group: `home` (the homepage, Research, Projects and About,
// one RiverLayout in App.jsx) and one per detail page, keyed by its slug (the
// placeholder rivers in ../detailRivers.js). A page with no group (an unknown slug)
// has no river: RiverLayout shows only the page content.
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
//          - Gentle random stirring keeps the flow changing. (A push curled water
//            into the upper curve's pocket until 2026-10-05; see below.)
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
// "Calm" (2026-10-01, on trial; the author worried the flow could overstimulate, and
// it lagged): every inflow at 0.7x (speed 50 -> 35, sideSpeed 50 -> 35, cornerSpeed
// 80 -> 56), cell 10 -> 12, half the stirring (stirIntensity 0.15 -> 0.075), about half
// the dots (spacing 22 -> 30) and opacity 0.5 -> 0.35 in the look below. Lattice speed
// 0.0095 -> 0.0085: on the coarser grid the peak Mach reached 0.194 (limit 0.2).
// No push (idea-painted-river, 2026-10-05): the author found the whirlpool in the upper
// curve still there in every painted look. The push (push=1.2 pushRadius=140) made it:
// it spun the pocket at 63% of the passing current's speed, where the bank alone, with
// nothing forced, keeps a slow back-eddy at about 25% (DECISIONS.md).
// Re-aimed inflow (the author, same day: "lets try to re-aim the inflow"): the focus
// (1300, -150) -> (1100, -150) and the corner jet 45 -> 20 degrees, so the current
// keeps closer to the bank past the bulge and feeds the pocket's natural back-eddy.
// Over two seeds the pocket went 0.125 -> 0.15 of the passing speed, its unsteadiness
// 0.23 -> 0.34 and its dots 0.52 -> 0.81 of the river's density (the bank alone: 0.27,
// 0.46, 0.46). The jet's angle mattered most; the focus alone, or tilting the side
// flow, did not help.
const RIVER_OPTIONS =
  "cell=12 lattice=0.0085 speed=35 re=100000 stir=1 stirIntensity=0.075 inflowAmplitude=0.5 " +
  "inflowFloor=0.6 side=1 sideTop=820 sideSpeed=35 sideAngle=0 " +
  "sideOutlet=0 cornerJet=250 cornerSpeed=56 cornerAngle=20 converge=1 convergeX=1100 " +
  "convergeY=-150 bedDrag=0.25 outletCells=12 spacing=30";

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
// Given the `river`, a box that moved onto land goes to the nearest spot in view that
// is on water instead (the detail pages' narrow rivers; the homepage's water is wide
// enough that it never happens there). With no such spot it stays where it moved.
export function placeControls(box, view, river = null) {
  const place = (at, size, edge, gap) =>
    at + size + CONTROLS_FIT <= edge ? at : Math.max(0, Math.min(at, edge - gap - size));
  const moved = {
    ...box,
    x: place(box.x, box.width, view.right, CONTROLS_GAP.right),
    y: place(box.y, box.height, view.bottom, CONTROLS_GAP.bottom),
  };
  if (!river || boxOnWater(moved, river)) return moved;
  let best = null;
  const step = 10;
  for (let y = 0; y + box.height + CONTROLS_FIT <= view.bottom; y += step) {
    for (let x = 0; x + box.width + CONTROLS_FIT <= view.right; x += step) {
      const distance = Math.hypot(x - box.x, y - box.y);
      if (best && distance >= best.distance) continue;
      if (boxOnWater({ ...box, x, y }, river)) best = { x, y, distance };
    }
  }
  return best ? { ...box, x: best.x, y: best.y } : moved;
}

// Whether the box lies on the river's water with `margin` page units to spare (its
// edges sampled every 12 units): right of the left bank, left of the right bank or the
// page's right edge, and inside the page.
export function boxOnWater(box, river, margin = 24) {
  const { x, y, width, height } = box;
  if (x < 0 || y < 0 || x + width > river.width || y + height > river.height) return false;
  for (let v = y; v <= y + height; v += Math.min(12, height)) {
    const left = evaluateBank(river.left, v).x;
    const right = river.right ? evaluateBank(river.right, v).x : river.width;
    if (x - left < margin || right - (x + width) < (river.right ? margin : 0)) return false;
  }
  return true;
}

const LOOK = Object.freeze({ radius: 1.75, fadeIn: 0.5, buckets: 3, lines: 0.65, opacity: 0.35, delay: 1 });

// ---- idea-painted-river: looks and flows to compare (?look=name, ?flow=name) ----
//
// The author (2026-10-05): the river should be a calm, relaxing presence that does not
// overstimulate, yet its flow turbulent, "like a fast river running in slow motion";
// and the picture both painterly (the streaky brushwork of Starry Night) and Studio
// Ghibli (soft and calm). The author kept four (2026-10-05) and dropped plain dots,
// slow dots and brush-stroke dots; then the dots altogether, "since they look like
// something swimming in the water": every look is painted water alone (dots: false),
// so painted and wash became one. Vivid is every river's look, the baseline going
// forward (the author, same day); the old dots stay as `legacy`. Motion energy
// (seed 7, 8 pairs over 20-52 s; today's dots: 9.7, one pair):
//   painted  slow motion (timeScale 0.35: the whole river at that rate), painted water
//            (paint.js): every swirl shows as a shape, not only as motion (5.3)
//   ghibli   the same in brighter, clearer colours (aqua and sky blue, sandy shallows,
//            white sparkles) (6.3)
//   starry   bolder, thicker, higher-contrast strokes at quarter speed: more Van
//            Gogh (7.6; one pair measured 15.7 before it was calmed)
// The tuner (/?tune) can still show the dots, as dots or brush strokes, to compare.
// Starry calmed (the author: remove it "unless we can find a way to reduce the motion.
// maybe make the strokes thicker and slower motion?"): timeScale 0.5 -> 0.25, strokes
// thicker (noiseScale 4.2 -> 9) and longer (step 2.8 -> 4.5), softer (contrast 2.6 ->
// 2), renewed less often (period 3 -> 8). Motion energy 15.7 -> 7.6 (painted 5.3).
const STARRY_PAINT = Object.freeze({
  strokeAlpha: 0.7, calm: 0.35, contrast: 2, soft: 0.03, noiseScale: 9, step: 4.5, period: 8,
});
// The painted looks: no dots, and no wait before the river starts. The 1 s `delay` was
// for the dots (the author, 2026-09-30); with the paint it only left the river blank
// for a second (the author, 2026-10-05: "i feel like it starts it too slow").
const PAINTED = Object.freeze({ ...LOOK, dots: false, delay: 0 });
const LEGACY_LOOK = Object.freeze({
  radius: 1.75, fadeIn: 0.5, buckets: 3, lines: 0.65, opacity: 0.5, delay: 1, flow: "pub",
});
export const LOOKS = Object.freeze({
  painted: Object.freeze({ ...PAINTED, timeScale: 0.35, paint: true }),
  ghibli: Object.freeze({
    ...PAINTED, timeScale: 0.35,
    paint: Object.freeze({
      washSlow: "#dcefe9", washFast: "#a9d2ea", shallow: "#eef1df", highlight: "#ffffff",
      colors: ["#2f6db5", "#4b93cf", "#7fbde0", "#c4e4ef"], highlights: 1,
      opacity: 0.85, edge: 0.06,
    }),
  }),
  starry: Object.freeze({ ...PAINTED, timeScale: 0.25, paint: STARRY_PAINT }),
  // Ghibli with the author's more striking paint from the tuner (2026-10-05: more and
  // stronger strokes, sharper, wider, denser in slow water, a subtler bank), calmed to
  // the author's limit of motion energy 7 ("i do like the more striking colors"): fewer
  // glints (1 -> 0.25), longer strokes (step 3.1 -> 4.8), slower repainting (period 5 ->
  // 8), softer edges (soft 0.05 -> 0.07) and quarter speed (timeScale 0.35 -> 0.25).
  // The author's tuner paint measured 12.3. Resolution 1.5 -> 1.25: 1.5 held 60 fps on
  // the author's M1 at devicePixelRatio 2 but 2 did not, so 1.5 leaves weaker GPUs
  // little room.
  vivid: Object.freeze({
    ...PAINTED, timeScale: 0.25,
    paint: Object.freeze({
      washSlow: "#dcefe9", washFast: "#a9d2ea", shallow: "#eef1df", highlight: "#ffffff",
      colors: ["#2f6db5", "#4b93cf", "#7fbde0", "#c4e4ef"], highlights: 0.25,
      opacity: 0.7, washAlpha: 0.7, strokeAlpha: 0.6, coverage: 0.5, calm: 0.7, depth: 0.3,
      contrast: 2, soft: 0.07, noiseScale: 8.5, step: 4.8, period: 8, edge: 0.1, shore: 0.4,
      shoreWidth: 16, nearWidth: 8, resolution: 1.25,
    }),
  }),
  // The old river style, kept as legacy (the author, 2026-10-05: "lets keep a legacy
  // code copy of the old river style"): the published site's look, its dots with
  // tracer lines at full speed, no paint (draw.js drawDots), on the published flow with
  // this day's flow changes (`flow: "pub"`, below). `pub` is the same look under the
  // name of its first link. ?look=legacy&flow=published is the published site exactly.
  legacy: LEGACY_LOOK,
  pub: LEGACY_LOOK,
});

// The flows: `calm` is the branch's own; `turbulent` is the river before calm (speed
// 50, cell 10, stirring 0.15) with the livelier forcing of river-livelier (more
// uneven inflow, more stirring, less eddy damping) and a faster corner jet, meant to
// be played in slow motion. Lattice speed 0.008 for Mach margin. Neither has a push,
// and both have the re-aimed inflow (2026-10-05); `whirlpool` is calm as it was before
// that day (its push, focus and corner jet), to compare. `pub` is the published site's
// flow (site-release f36dc1b, 2026-10-01: before calm, speed 50, cell 10, stirring
// 0.15, dots every 22 units) with this day's changes: no push, focus x 1300 -> 1100,
// corner jet 45 -> 20 degrees; `published` is that flow exactly as published, the
// legacy copy. Neither has saved start flows: they warm up on load.
export const FLOWS = Object.freeze({
  calm: RIVER_OPTIONS,
  turbulent:
    "cell=10 lattice=0.008 speed=50 re=100000 smag=0.07 stir=1 stirIntensity=0.2 " +
    "inflowAmplitude=0.9 inflowFloor=0.35 side=1 sideTop=820 " +
    "sideSpeed=50 sideAngle=0 sideOutlet=0 cornerJet=250 cornerSpeed=100 cornerAngle=20 " +
    "converge=1 convergeX=1100 convergeY=-150 bedDrag=0.25 outletCells=12 spacing=30",
  whirlpool: `${RIVER_OPTIONS} push=1.2 pushRadius=140 convergeX=1300 cornerAngle=45`,
  pub:
    "cell=10 lattice=0.0095 speed=50 re=100000 stir=1 inflowAmplitude=0.5 inflowFloor=0.6 " +
    "side=1 sideTop=820 sideSpeed=50 sideAngle=0 sideOutlet=0 " +
    "cornerJet=250 cornerSpeed=80 cornerAngle=20 converge=1 convergeX=1100 convergeY=-150 " +
    "bedDrag=0.25 outletCells=12",
  published:
    "cell=10 lattice=0.0095 speed=50 re=100000 stir=1 inflowAmplitude=0.5 inflowFloor=0.6 " +
    "push=1.2 pushRadius=140 side=1 sideTop=820 sideSpeed=50 sideAngle=0 sideOutlet=0 " +
    "cornerJet=250 cornerSpeed=80 cornerAngle=45 converge=1 convergeX=1300 convergeY=-150 " +
    "bedDrag=0.25 outletCells=12",
});

function urlChoice(key) {
  return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(key);
}

// The look for a river: ?look=name if it names one, otherwise `fallback`. For quick
// comparisons, ?look.key=value and ?paint.key=value override single numbers.
export function pickLook(fallback) {
  const look = { ...(LOOKS[urlChoice("look")] ?? fallback) };
  if (typeof window === "undefined") return look;
  for (const [key, raw] of new URLSearchParams(window.location.search)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (key.startsWith("look.")) look[key.slice(5)] = value;
    if (key.startsWith("paint.")) {
      look.paint = { ...(look.paint === true || !look.paint ? {} : look.paint), [key.slice(6)]: value };
    }
  }
  return look;
}

// The homepage river's options: ?flow=name if it names one, otherwise the flow the
// ?look= names (`pub`). Detail rivers keep theirs.
export function pickFlow(options) {
  if (options !== RIVER_OPTIONS) return options;
  return FLOWS[urlChoice("flow") ?? LOOKS[urlChoice("look")]?.flow] ?? options;
}

export const riverConfig = {
  home: {
    river: pageRiver,
    options: RIVER_OPTIONS,
    look: LOOKS.vivid,
    controls: RIVER_CONTROLS,
  },
  // The detail pages' placeholder rivers (the author, 2026-10-01), with the homepage's
  // look. Untuned: their own flows are for later.
  ...Object.fromEntries(
    Object.entries(detailRivers).map(([slug, { river, options, controls }]) => [
      slug,
      { river, options, look: LOOKS.vivid, controls },
    ]),
  ),
};

// The options the simulation runs: a group's tuned options plus the control box as a
// solid obstacle (kept out of `options`, so the tuner's copied config stays about the
// flow, and moving the box moves the obstacle with it).
export function simulationOptions(options, controls) {
  if (!controls) return options;
  const { x, y, width, height } = controls;
  return `${options} boxX=${x} boxY=${y} boxW=${width} boxH=${height}`;
}
