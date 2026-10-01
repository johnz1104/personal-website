// Draws the river's dots on its canvas. Pure: everything comes in through the
// arguments, so the tuning panel can change the look without restarting the river.
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
export function drawDots(ctx, {
  dots, count, stride = 4, tailAges, scale, dpr, radius, fadeIn, palette, opacity = 1,
  visible = true, clear = 1, lines = 0,
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
