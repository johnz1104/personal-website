import { createCubicBank } from "./geometry.js";

// Placeholder rivers for the detail pages, one per page, keyed by slug (the author,
// 2026-10-01). Designed and checked with work/river-placeholders/design.mjs; edit the
// shapes there and copy the knots here. They live in the page river's domain (1728 x
// 1080 page units, y down), like the homepage river, and follow the author's rules:
// - The visitor stands on the near (left) bank with the text; water is right of it and
//   runs up the page or out through the right edge, so looking downstream the land is
//   on the left, as on the homepage. No river may suggest the visitor is across it.
// - The water stays 40 units clear of the detail text (x 517-1211, y up to 447 in a
//   1440 px window) and at least 120 units wide where it flows.
// - Sizes, as water area against the homepage river's: the research pages 30% each;
//   the Cold War simulator and the CFD library 30%, the neural operator 26%, the N-body
//   solver 22% (smaller down the Projects list, gently).
// - One bank on every page, the far side never shown (the author, 2026-10-05: "they
//   should simply be one line for the river"), so one river seems to run through every
//   page. The Cold War simulator and the neural operator had two banks until then.
// - The Flow box at one spot on every page, the homepage's (the author, same day): in
//   the author's window and larger ones there is water under it on every page.
// - Bottom to top, and no bay near the bottom that the water rising from the inlet
//   does not run into (the author: "super defined curves towards the bottom have a
//   hard time filling in"): the Cold War simulator's and the neural operator's lower
//   banks are straight or lean toward the rising water.
const WIDTH = 1728;
const HEIGHT = 1080;
// Banks that turn out through the right edge continue past it; their knots sit in a
// wider domain. The solver's domain ends 120 units past the page (sideMargin), so the
// bank above the exit is beyond it and that part of the page stays dry.
const WIDE = 2600;

function bank(knots, width = WIDTH) {
  return createCubicBank({ width, height: HEIGHT, knots: knots.map(([x, y]) => ({ x, y })) });
}

function oneBank(knots, width) {
  return Object.freeze({ width: WIDTH, height: HEIGHT, left: bank(knots, width), right: null });
}

// A plain flow for all of them: the homepage's grid, Reynolds number, stirring and dot
// spacing without its designed jets and push, so each shape's banks make the flow.
// Untuned placeholders, on the homepage's "calm" trial (config.js): speeds at 0.7x.
const BASE =
  "cell=12 lattice=0.0095 speed=28 re=100000 stir=1 stirIntensity=0.075 inflowAmplitude=0.5 " +
  "inflowFloor=0.6 outletCells=12 spacing=30";
// One bank, out through the top: a small side inflow at the bottom of the right edge.
// It switches on the solver's outlet channel and backflow clamp, without which a
// narrow one-bank river at this Reynolds number blows up within a minute.
const TOP = `${BASE} side=1 sideTop=1040 sideSpeed=14 sideAngle=30 sideOutlet=0`;
// Out through the right edge: the top is closed, the edge is an outlet down to
// `outletBottom`, and a gentle side inflow enters the edge's last stretch, below `top`.
const exitOptions = (outletBottom, top) =>
  `${BASE} side=1 topOutlet=0 sideOutlet=1 sideOutletBottom=${outletBottom} sideTop=${top} sideSpeed=14 sideAngle=30`;

// The Flow box: the homepage's spot (config.js, RIVER_CONTROLS) on every page, page
// units. In a window too small for it, RiverLayout moves it left or up as on the
// homepage, and, on a page with land there, to the nearest spot in view still on water
// (placeControls): in 1280 x 720 windows the edge stream, the side-fed river and the
// narrows move it.
const CONTROLS = Object.freeze({ x: 1500, y: 782, width: 120, height: 48 });

export const detailRivers = {
  // Research: one size (30%).
  "effective-turbulence-laws": {
    name: "edge stream",
    river: oneBank([[1495, 0], [1430, 270], [1495, 540], [1354, 810], [1457, 1080]]),
    options: TOP,
    controls: CONTROLS,
  },
  "spontaneous-stochasticity": {
    name: "diagonal",
    river: oneBank([[2350, 0], [2050, 230], [1760, 470], [1163, 790], [674, 1080]], WIDE),
    options: exitOptions(760, 1020),
    controls: CONTROLS,
  },
  "scramjet-inlet-unstart": {
    name: "side-fed",
    // Lower bank moved left (2026-10-05; 1548 -> 1440 at y 810) for the Flow box.
    river: oneBank([[1331, 0], [1387, 270], [1482, 540], [1440, 810], [1530, 1080]]),
    options: `${BASE} side=1 sideTop=620 sideSpeed=35 sideAngle=35 sideOutlet=0`,
    controls: CONTROLS,
  },
  // Projects: the Cold War simulator and the CFD library alike (30%), then smaller.
  "cold-war-simulator": {
    name: "long bend",
    // One bank (2026-10-05): one long, soft bend from a wide mouth at the bottom to a
    // neck beside the text, out the top (an S before, "too like a sine wave").
    river: oneBank([[1570, 0], [1605, 240], [1491, 500], [1279, 780], [1226, 1080]]),
    options: TOP,
    controls: CONTROLS,
  },
  "cfd-research-library": {
    name: "narrows",
    river: oneBank([[1590, 0], [1538, 250], [1431, 560], [1325, 830], [1261, 1080]]),
    options: TOP,
    controls: CONTROLS,
  },
  "stochastic-fourier-neural-operator": {
    name: "pool",
    // One bank (2026-10-05): a broad, straight-sided pool in the lower half, narrowing
    // at a shoulder below the text, out the top.
    river: oneBank([[1590, 0], [1575, 230], [1532, 470], [1385, 700], [1346, 880], [1366, 1080]]),
    options: TOP,
    controls: CONTROLS,
  },
  "n-body-solver": {
    name: "corner bend",
    river: oneBank([[2550, 0], [2400, 280], [2100, 520], [1224, 790], [1028, 1080]], WIDE),
    options: exitOptions(900, 1040),
    controls: CONTROLS,
  },
};
