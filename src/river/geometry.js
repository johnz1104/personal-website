// Shared boundary geometry in fixed reference units (x right, y down).
// No viewport or DOM measurements belong in this module. See README.md.

// Natural cubic spline x = f(y). Each segment stores the coefficients of
// x = a + b*u + c*u^2 + d*u^3, where u = y - y0, for y0 <= y <= y1.
export function createCubicBank({ width, height, knots }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError("The river domain must have positive finite dimensions.");
  }
  if (knots.length < 2 || knots[0].y !== 0 || knots.at(-1).y !== height) {
    throw new RangeError("Bank knots must span the top and bottom of the domain.");
  }
  const points = knots.map(({ x, y }, i) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || x >= width
      || (i > 0 && y <= knots[i - 1].y)) {
      throw new RangeError("Bank knots must lie inside the channel width, ordered by increasing y.");
    }
    return Object.freeze({ x, y });
  });

  const count = points.length;
  const spans = points.slice(1).map((point, i) => point.y - points[i].y);
  const diagonal = Array(count).fill(0);
  const upper = Array(count).fill(0);
  const rhs = Array(count).fill(0);
  diagonal[0] = diagonal[count - 1] = 1;

  // Solve for knot second derivatives. Natural endpoints have f'' = 0.
  for (let i = 1; i < count - 1; i++) {
    const factor = spans[i - 1] / diagonal[i - 1];
    diagonal[i] = 2 * (spans[i - 1] + spans[i]) - factor * upper[i - 1];
    upper[i] = spans[i];
    rhs[i] = 6 * ((points[i + 1].x - points[i].x) / spans[i]
      - (points[i].x - points[i - 1].x) / spans[i - 1]) - factor * rhs[i - 1];
  }
  const second = Array(count).fill(0);
  for (let i = count - 2; i >= 0; i--) {
    second[i] = (rhs[i] - upper[i] * second[i + 1]) / diagonal[i];
  }

  const segments = spans.map((span, i) => Object.freeze({
    y0: points[i].y,
    y1: points[i + 1].y,
    a: points[i].x,
    b: (points[i + 1].x - points[i].x) / span
      - span * (2 * second[i] + second[i + 1]) / 6,
    c: second[i] / 2,
    d: (second[i + 1] - second[i]) / (6 * span),
  }));

  return Object.freeze({
    width,
    height,
    knots: Object.freeze(points),
    segments: Object.freeze(segments),
  });
}

// Exact boundary position and derivatives for meshing and smooth normals.
export function evaluateBank(bank, y) {
  if (!Number.isFinite(y) || y < 0 || y > bank.height) {
    throw new RangeError("Bank evaluation must stay inside the reference domain.");
  }
  const { y0, a, b, c, d } = bank.segments.find(segment => y <= segment.y1);
  const u = y - y0;
  return {
    x: ((d * u + c) * u + b) * u + a,
    y,
    slope: (3 * d * u + 2 * c) * u + b,
    secondDerivative: 6 * d * u + 2 * c,
  };
}

// Reference-coordinate polyline, ordered from the bottom inlet to top outlet.
// This is a sampling convenience, not a prescribed solver resolution.
export function sampleBank(bank, samplesPerSegment = 32) {
  if (!Number.isInteger(samplesPerSegment) || samplesPerSegment < 1) {
    throw new RangeError("Use at least one sample interval per cubic piece.");
  }
  const line = [{ ...bank.knots.at(-1) }];
  for (let i = bank.segments.length - 1; i >= 0; i--) {
    const { y0, y1 } = bank.segments[i];
    for (let step = 1; step <= samplesPerSegment; step++) {
      const y = step === samplesPerSegment
        ? y0
        : y1 - (y1 - y0) * step / samplesPerSegment;
      const { x } = evaluateBank(bank, y);
      line.push({ x, y });
    }
  }
  return line;
}

// Each polynomial becomes one exact SVG cubic Bezier, with linear y(t).
// Drawing does not depend on the density of a sampled mesh/polyline.
export function bankToPath(bank) {
  const first = bank.knots[0];
  const commands = [`M${first.x} ${first.y}`];
  for (const { y0, y1, a, b, c, d } of bank.segments) {
    const h = y1 - y0;
    const endX = ((d * h + c) * h + b) * h + a;
    const endSlope = (3 * d * h + 2 * c) * h + b;
    commands.push(`C${a + b * h / 3} ${y0 + h / 3} ${endX - endSlope * h / 3} ${y1 - h / 3} ${endX} ${y1}`);
  }
  return commands.join(" ");
}

// Continue a bank below its last knot, in a larger domain, through new knots. The
// existing pieces are kept exactly. Each new cubic piece starts with the position,
// slope and curvature of the piece above (C2 joins) and ends at its knot.
export function extendBank(bank, { width, height, knots }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < bank.width
    || height <= bank.height) {
    throw new RangeError("The extended domain must contain the bank's domain.");
  }
  if (knots.length < 1 || knots.at(-1).y !== height) {
    throw new RangeError("Extension knots must end at the bottom of the new domain.");
  }
  let previous = bank.knots.at(-1);
  const last = bank.segments.at(-1);
  const span = last.y1 - last.y0;
  let slope = (3 * last.d * span + 2 * last.c) * span + last.b;
  let curvature = 6 * last.d * span + 2 * last.c;
  const segments = knots.map(({ x, y }) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || x >= width || y <= previous.y) {
      throw new RangeError("Extension knots must lie inside the domain, ordered by increasing y.");
    }
    const h = y - previous.y;
    const a = previous.x;
    const b = slope;
    const c = curvature / 2;
    const d = (x - a - b * h - c * h * h) / (h * h * h);
    slope = (3 * d * h + 2 * c) * h + b;
    curvature = 6 * d * h + 2 * c;
    const segment = Object.freeze({ y0: previous.y, y1: y, a, b, c, d });
    previous = { x, y };
    return segment;
  });
  return Object.freeze({
    width,
    height,
    knots: Object.freeze([...bank.knots, ...knots.map(({ x, y }) => Object.freeze({ x, y }))]),
    segments: Object.freeze([...bank.segments, ...segments]),
  });
}

// A river between two banks x = f(y) (left) and x = g(y) (right) over the same
// domain. Both curves must stay inside the domain (a spline can overshoot its knots),
// and the channel must stay open: g - f >= minWidth everywhere.
export function createRiver({ left, right, minWidth = 1 }) {
  if (left.width !== right.width || left.height !== right.height) {
    throw new RangeError("Both banks must share one domain.");
  }
  let narrowest = { width: Infinity, y: 0 };
  for (let i = 0; i <= 2000; i++) {
    const y = (left.height * i) / 2000;
    const f = evaluateBank(left, y).x;
    const g = evaluateBank(right, y).x;
    if (!(f > 0 && g < left.width)) {
      throw new RangeError(`A bank leaves the domain at y = ${y}.`);
    }
    const gap = g - f;
    if (gap < narrowest.width) narrowest = { width: gap, y };
  }
  if (!(narrowest.width >= minWidth)) {
    throw new RangeError(`The banks come within ${narrowest.width} units at y = ${narrowest.y}.`);
  }
  return Object.freeze({
    width: left.width,
    height: left.height,
    left,
    right,
    narrowest: Object.freeze(narrowest),
  });
}

// The same bank in a smaller domain: its pieces cut at `height` (the polynomials are
// unchanged; the last piece ends there).
export function cropBank(bank, { width, height }) {
  if (!(height > bank.segments[0].y0) || height > bank.height) {
    throw new RangeError("The crop must end inside the bank's domain.");
  }
  const segments = bank.segments
    .filter(({ y0 }) => y0 < height)
    .map((s) => (s.y1 > height ? Object.freeze({ ...s, y1: height }) : s));
  const end = evaluateBank(bank, height);
  const knots = [...bank.knots.filter(({ y }) => y < height), Object.freeze({ x: end.x, y: height })];
  return Object.freeze({
    width,
    height,
    knots: Object.freeze(knots),
    segments: Object.freeze(segments),
  });
}
