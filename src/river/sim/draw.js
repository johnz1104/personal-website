// Draws the river's dots on its canvas. Pure: everything comes in through the
// arguments, so the tuning panel can change the look without restarting the river.
//
// Legacy (idea-painted-river, 2026-10-05): the dots were the river's look until the
// painted water (paint.js) replaced them. The author asked to keep this code as the
// old river style: ?look=legacy (config.js), and the tuner's dot settings.
//
// The canvas backing store is its CSS size times devicePixelRatio. One transform,
// dpr * scale with scale = CSS width / bank width, maps reference coordinates
// (1440 x 900 page units) to backing-store pixels, so resizing and zoom change only
// the drawing, never the simulation.

// New dots fade in over `fadeIn` seconds in this many opacity steps.
const FADE_STEPS = 4;

// Any CSS color as [r, g, b], read back through the context's normalized fillStyle.
function parseColor(ctx, color) {
  ctx.fillStyle = "#000000";
  ctx.fillStyle = color;
  const value = ctx.fillStyle;
  if (value.startsWith("#")) {
    return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  }
  return value.match(/[\d.]+/g).slice(0, 3).map(Number);
}

// The dots' shades from the CSS tokens --color-dot-1, --color-dot-2, ... (darkest
// first), up to the first one that is not set.
export function readDotColors(style) {
  const colors = [];
  for (let n = 1; ; n++) {
    const value = style.getPropertyValue(`--color-dot-${n}`).trim();
    if (!value) return colors;
    colors.push(value);
  }
}

// `buckets` fill colors evenly across `colors` (darkest first), the first and last
// included. As many buckets as colors gives exactly those colors; more blend between
// neighbours.
export function makePalette(ctx, colors, buckets) {
  const stops = colors.map((color) => parseColor(ctx, color));
  return Array.from({ length: buckets }, (_, i) => {
    const t = (buckets > 1 ? i / (buckets - 1) : 0.5) * (stops.length - 1);
    const at = Math.min(Math.floor(t), stops.length - 2);
    const a = stops[Math.max(at, 0)];
    const b = stops[Math.min(at + 1, stops.length - 1)];
    const f = t - Math.max(at, 0);
    const [r, g, bl] = a.map((v, k) => Math.round(v + f * (b[k] - v)));
    return `rgb(${r}, ${g}, ${bl})`;
  });
}

// dots: Float32Array, `stride` floats per dot: x, y, tone (0..1), age (s), then the dot's
// tail: its past positions (x, y), newest first; tailAges holds each sample's age in
// seconds (the same for every dot; worker.js).
// opacity scales every dot; visible = false draws none; clear (0..1) is how much of
// the previous frame to erase first: 1 clears it, less leaves fading trails, 0 keeps it.
// lines: seconds of each dot's recent path drawn as a line behind it (0 = none), so a
// faster dot draws a longer line. The dot and its line are one round-capped stroke as
// thick as the dot, at the dot's opacity: the dot is the line's rounded head.
// brush: draw each dot and its line as a painted stroke instead (drawBrushes).
export function drawDots(ctx, {
  dots, count, stride = 4, tailAges, scale, dpr, radius, fadeIn, palette, opacity = 1,
  visible = true, clear = 1, lines = 0, brush = null,
}) {
  const canvas = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (clear >= 1) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else if (clear > 0) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = clear;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  if (!visible || !dots || count === 0) return;

  const k = dpr * scale;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const samples = (stride - 4) / 2;
  const withLines = lines > 0 && samples > 0 && tailAges?.length === samples;
  if (brush && withLines) {
    drawBrushes(ctx, { dots, count, stride, tailAges, radius, fadeIn, palette, opacity, lines, brush });
    return;
  }
  // One path per (color, opacity) pair: a handful of fills or strokes instead of one
  // per dot. Within one path, overlapping dots and lines do not darken each other.
  const buckets = palette.length;
  const paths = [];
  for (let i = 0; i < count; i++) {
    const at = stride * i;
    const x = dots[at];
    const y = dots[at + 1];
    const color = Math.min(buckets - 1, Math.floor(dots[at + 2] * buckets));
    const step = fadeIn > 0
      ? Math.min(FADE_STEPS - 1, Math.floor((dots[at + 3] / fadeIn) * FADE_STEPS))
      : FADE_STEPS - 1;
    const index = step * buckets + color;
    const path = (paths[index] ??= new Path2D());
    if (!withLines) {
      path.moveTo(x + radius, y);
      path.arc(x, y, radius, 0, 2 * Math.PI);
      continue;
    }
    // Back along the dot's path for exactly `lines` seconds, cutting the last segment
    // short, so the tail's end moves smoothly between samples.
    path.moveTo(x, y);
    let px = x;
    let py = y;
    let pt = 0;
    let length = 0;
    for (let s = 0; s < samples; s++) {
      const sx = dots[at + 4 + 2 * s];
      const sy = dots[at + 5 + 2 * s];
      const st = tailAges[s];
      if (st >= lines) {
        const f = st > pt ? (lines - pt) / (st - pt) : 0;
        const ex = px + f * (sx - px);
        const ey = py + f * (sy - py);
        length += Math.hypot(ex - px, ey - py);
        path.lineTo(ex, ey);
        break;
      }
      length += Math.hypot(sx - px, sy - py);
      path.lineTo(sx, sy);
      px = sx;
      py = sy;
      pt = st;
    }
    // A dot that has not moved yet still needs a stroke for its round head.
    if (length < 0.01) path.lineTo(x + 0.01, y);
  }
  if (withLines) {
    ctx.lineWidth = 2 * radius;   // the author: as thick as the dots
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  paths.forEach((path, index) => {
    ctx.globalAlpha = (opacity * (Math.floor(index / buckets) + 1)) / FADE_STEPS;
    if (withLines) {
      ctx.strokeStyle = palette[index % buckets];
      ctx.stroke(path);
    } else {
      ctx.fillStyle = palette[index % buckets];
      ctx.fill(path);
    }
  });
  ctx.globalAlpha = 1;
}

// A dot's path for the last `lines` seconds, head first, into `out` as x, y pairs; the
// last segment is cut short so the end moves smoothly between samples. Returns the
// number of points.
function strokePath(dots, at, samples, tailAges, lines, out) {
  let px = dots[at];
  let py = dots[at + 1];
  let pt = 0;
  out[0] = px;
  out[1] = py;
  let n = 1;
  for (let s = 0; s < samples; s++) {
    const sx = dots[at + 4 + 2 * s];
    const sy = dots[at + 5 + 2 * s];
    const st = tailAges[s];
    if (st >= lines) {
      const f = st > pt ? (lines - pt) / (st - pt) : 0;
      out[2 * n] = px + f * (sx - px);
      out[2 * n + 1] = py + f * (sy - py);
      return n + 1;
    }
    out[2 * n] = sx;
    out[2 * n + 1] = sy;
    n++;
    px = sx;
    py = sy;
    pt = st;
  }
  return n;
}

// Painted strokes (idea-painted-river): each dot and its recent path as one brush dab,
// a filled ribbon that swells behind a round head and tapers to a dry tail, with two
// bristle streaks in the next lighter shade along it. A few dots (brush.glints, a share
// of the tones) are pale highlights that brighten and fade over a few seconds, like
// light catching the water.
//   brush: { width (x radius, default 1.6), taper (0..1, how thin the tail gets),
//            bristles (0..1 alpha of the streaks), glints (share), glint (color),
//            share (0..1, default 1: the share of the dots drawn, for a sparser look) }
export function drawBrushes(ctx, {
  dots, count, stride, tailAges, radius, fadeIn, palette, opacity, lines, brush,
}) {
  const samples = (stride - 4) / 2;
  const buckets = palette.length;
  const width = radius * (brush.width ?? 1.6);
  const taper = brush.taper ?? 0.75;
  const glints = brush.glints ?? 0;
  const share = brush.share ?? 1;
  const points = new Float32Array(2 * (samples + 2));
  const left = new Float32Array(2 * (samples + 2));
  const bodies = [];
  const bristles = [];
  const glintPath = [];
  for (let i = 0; i < count; i++) {
    const at = stride * i;
    const tone = dots[at + 2];
    // A fixed pick per dot (its tone is random and constant): which dots are drawn.
    if (share < 1 && (tone * 7919) % 1 >= share) continue;
    const age = dots[at + 3];
    const step = fadeIn > 0
      ? Math.min(FADE_STEPS - 1, Math.floor((age / fadeIn) * FADE_STEPS))
      : FADE_STEPS - 1;
    const n = strokePath(dots, at, samples, tailAges, lines, points);
    // Arc length, for the width profile.
    let total = 0;
    for (let j = 1; j < n; j++) {
      total += Math.hypot(points[2 * j] - points[2 * j - 2], points[2 * j + 1] - points[2 * j - 1]);
    }
    const isGlint = glints > 0 && tone >= 1 - glints;
    let path;
    let bristle = null;
    if (isGlint) {
      // Brightens and fades over about 4 s of its life, then rests.
      const phase = (age / 4 + tone * 7) % 1.6;
      const glow = phase < 1 ? Math.sin(Math.PI * phase) : 0;
      const g = Math.min(FADE_STEPS - 1, Math.floor(glow * FADE_STEPS));
      if (g <= 0) continue;
      path = (glintPath[Math.min(g, step)] ??= new Path2D());
    } else {
      const color = Math.min(buckets - 1, Math.floor(tone * buckets));
      const index = step * buckets + color;
      path = (bodies[index] ??= new Path2D());
      if (brush.bristles > 0 && total > width) {
        bristle = (bristles[step * buckets + Math.min(buckets - 1, color + 1)] ??= new Path2D());
      }
    }
    if (total < 0.5) {
      path.moveTo(points[0] + width, points[1]);
      path.arc(points[0], points[1], width, 0, 2 * Math.PI);
      continue;
    }
    const w = isGlint ? width * 0.55 : width;
    // Offsets along the normals: the ribbon's left side forwards, its right side back.
    let s = 0;
    for (let j = 0; j < n; j++) {
      const a = Math.max(0, j - 1);
      const b = Math.min(n - 1, j + 1);
      let tx = points[2 * b] - points[2 * a];
      let ty = points[2 * b + 1] - points[2 * a + 1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      if (j > 0) s += Math.hypot(points[2 * j] - points[2 * j - 2], points[2 * j + 1] - points[2 * j - 1]);
      const u = s / total;
      // Full just behind the head, thinning towards the tail.
      const half = w * (1 - taper * u * u) * (0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, u * 2.5)));
      left[2 * j] = -ty * half;
      left[2 * j + 1] = tx * half;
    }
    // The round head: a half circle ahead of the first point (the normal is the tail's
    // direction turned a quarter, so half a turn on passes the front).
    const hw = Math.hypot(left[0], left[1]);
    const ang = Math.atan2(left[1], left[0]);
    path.moveTo(points[0] + left[0], points[1] + left[1]);
    path.arc(points[0], points[1], hw, ang, ang + Math.PI);
    for (let j = 0; j < n; j++) path.lineTo(points[2 * j] - left[2 * j], points[2 * j + 1] - left[2 * j + 1]);
    for (let j = n - 1; j >= 0; j--) path.lineTo(points[2 * j] + left[2 * j], points[2 * j + 1] + left[2 * j + 1]);
    path.closePath();
    if (bristle) {
      for (const side of [0.45, -0.35]) {
        bristle.moveTo(points[0] + side * left[0], points[1] + side * left[1]);
        for (let j = 1; j < n - 1; j++) {
          bristle.lineTo(points[2 * j] + side * left[2 * j], points[2 * j + 1] + side * left[2 * j + 1]);
        }
      }
    }
  }
  bodies.forEach((path, index) => {
    ctx.globalAlpha = (opacity * (Math.floor(index / buckets) + 1)) / FADE_STEPS;
    ctx.fillStyle = palette[index % buckets];
    ctx.fill(path);
  });
  if (brush.bristles > 0) {
    ctx.lineWidth = width * 0.35;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    bristles.forEach((path, index) => {
      ctx.globalAlpha = (brush.bristles * opacity * (Math.floor(index / buckets) + 1)) / FADE_STEPS;
      ctx.strokeStyle = palette[index % buckets];
      ctx.stroke(path);
    });
  }
  ctx.fillStyle = brush.glint ?? "#fbf7ea";
  glintPath.forEach((path, g) => {
    ctx.globalAlpha = Math.min(1, (opacity * 2 * g) / (FADE_STEPS - 1));
    ctx.fill(path);
  });
  ctx.globalAlpha = 1;
}
