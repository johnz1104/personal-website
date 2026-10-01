import { createCubicBank, createRiver, extendBank } from "./geometry.js";

// The homepage's single source of boundary geometry for drawing and meshing.
// Five fixed knots produce four C2-continuous cubic pieces. Edit the three
// interior knots to tune the bends; never derive them from viewport/card size.
// The current shape is kept for page review. homeRiver below extends it into the lake.
export const homeBank = createCubicBank({
  width: 1440,
  height: 900,
  knots: [
    { x: 1152, y: 0 },   // Outlet: 80% across at the reference size.
    { x: 900, y: 210 },
    { x: 955, y: 410 },
    { x: 700, y: 650 },
    { x: 432, y: 900 },  // Inlet: 30% across at the reference size.
  ],
});

// The lake river (the author's Gate A choice, 2026-09-27). The homepage bank continues
// below y = 900 as a lake shore, and a second bank closes the river on the right. The
// domain is bigger than any screen: each screen shows its top-left part at the page
// scale 5/6, so the right bank is hidden on 13" and 14" MacBooks. The four pieces of
// homeBank are kept exactly. Designed with work/river-design.html.
export const homeRiver = createRiver({
  left: extendBank(homeBank, {
    width: 3100,
    height: 1600,
    knots: [
      { x: 230, y: 1150 },
      { x: 60, y: 1600 },
    ],
  }),
  right: createCubicBank({
    width: 3100,
    height: 1600,
    knots: [
      { x: 1993, y: 0 },
      { x: 1887, y: 297 },
      { x: 2170, y: 459 },
      { x: 2280, y: 945 },
      { x: 2768, y: 1099 },
      { x: 2874, y: 1488 },
      { x: 3053, y: 1600 },
    ],
  }),
  minWidth: 200,
});
