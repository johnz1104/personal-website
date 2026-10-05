import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_SCALE, pageScale } from "./config.js";
import { drawDots, makePalette, readDotColors } from "./draw.js";
import { createPainter } from "./paint.js";
import { takePrestartedWorker } from "./prestart.js";

// Frame-time samples kept for the tuning panel's mean and p95 (about 5 s at 60 Hz).
const STATS_FRAMES = 300;

// A new random 64-bit seed for each river, or ?seed=N to pin one for debugging.
export function pickSeed() {
  const pinned = new URLSearchParams(window.location.search).get("seed");
  if (pinned !== null && /^\d+$/.test(pinned)) return BigInt.asUintN(64, BigInt(pinned));
  const [lo, hi] = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(hi) << 32n) | BigInt(lo);
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// The dots' random walk is off while tracer lines are drawn (the author: tails should
// follow the water, not wiggle).
export function wantsJitter(look) {
  return look.tracers === false || !((look.lines ?? 0) > 0);
}

// The painted water's settings in a look (paint.js): look.paint is true for the
// defaults or an object of overrides; absent or false for none.
export function paintLook(look) {
  if (!look.paint) return null;
  return look.paint === true ? {} : look.paint;
}

// One painter per canvas: React's development double mount reuses it, since a canvas
// keeps its WebGL context for life.
const painters = new WeakMap();

function painterFor(canvas, river) {
  const known = painters.get(canvas);
  if (known && known.river === river) return known.painter;
  let painter = null;
  try {
    painter = createPainter(canvas, river);
  } catch (error) {
    console.error(`[river] painted water off: ${error.message}`);
  }
  painters.set(canvas, { river, painter });
  return painter;
}

function pushSample(samples, value) {
  samples.push(value);
  if (samples.length > STATS_FRAMES) samples.shift();
}

// Whether the river is running: the visitor's "Flow" toggle. It is not remembered
// (the author, 2026-09-30): every page load starts running, unless the visitor's
// computer asks for reduced motion.
// Earlier versions kept the choice under this key; what they kept is dropped.
const OLD_PLAYING_KEY = "river-flow";

export function readPlaying() {
  for (const storage of ["localStorage", "sessionStorage"]) {
    try {
      window[storage].removeItem(OLD_PLAYING_KEY);
    } catch {
      // Blocked storage keeps nothing.
    }
  }
  return !window.matchMedia(REDUCED_MOTION).matches;
}

export function useRiverPlaying() {
  const [playing, setPlaying] = useState(readPlaying);
  const toggle = useCallback(() => setPlaying((on) => !on), []);
  return [playing, toggle];
}

// Runs one river in a Web Worker and draws its dots on canvasRef's canvas.
//
// The river restarts only when `river`, `options`, `seed` or `enabled` change.
// Resizing, browser zoom, scrolling and `look` changes only redraw; a resize also
// tells the worker the new visible box, where dots enter and leave. At most one
// frame is in flight: a slow device runs the river slower than real time instead
// of queueing frames. A hidden tab stops requestAnimationFrame, which pauses the
// river; it resumes with a normal frame step instead of a jump. `paused` (the page's
// "Flow" toggle) does the same without restarting anything: the dots freeze where they
// are and the worker idles until it is unpaused.
//
// Returns a ref for the tuning panel, to read outside rendering. While a river runs,
// ref.current holds `stats` (seed, warm-up, frame times, the latest diagnostics)
// and `frame()`, a copy of the latest dots; otherwise it is null.
//
// idea-painted-river: look.timeScale plays the river in slow motion (0.5 = half speed:
// the same flow, dots and paint, at half the rate, and half the lattice steps per
// second). With look.paint, paintCanvasRef's canvas shows the painted water (paint.js)
// under the dots; the worker then sends the flow field with every frame.
export function useRiverSimulation({
  canvasRef, paintCanvasRef = null, river, options, look, seed, enabled, paused = false,
}) {
  const lookRef = useRef(look);
  const pausedRef = useRef(paused);
  const riverRef = useRef(null);

  useEffect(() => {
    lookRef.current = look;
    riverRef.current?.redraw();
  }, [look]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const style = getComputedStyle(canvas);
    const tokens = {
      colors: readDotColors(style),
    };
    const stats = {
      seed, options, startedAt: performance.now(), warmupMs: null, start: null, diagnostics: null,
      diagnosticsAt: 0, previousDiagnostics: null, previousDiagnosticsAt: 0,
      simMs: [], drawMs: [], late: [], error: null, view: null, scale: null, zoom: null,
    };

    let worker = null;
    let disposed = false;
    let ready = false;
    let startAt = Infinity;   // when the first frame may be asked for (look.delay)
    let inFlight = false;
    let front = null;   // latest dots: { buffer, count }; drawn, never sent
    let spare = null;   // the other buffer, lent to the worker with each frame
    let lastTime = null;
    let raf = 0;
    let dirty = true;
    let dpr = 1;
    let scale = pageScale();   // CSS px per page unit, updated on resize
    let view = null;   // visible box in page units: { right, bottom }
    let palette = null;
    let paletteKey = "";
    // Sent to the worker when it changes (wantsJitter).
    const wantJitter = () => wantsJitter(lookRef.current);
    let jitter = wantJitter();
    // The painted water, made the first time a look asks for it (null where WebGL2 is
    // missing: the dots alone then).
    const paintCanvas = paintCanvasRef?.current ?? null;
    let painter = null;
    const wantField = () => {
      if (!paintCanvas || !paintLook(lookRef.current)) return false;
      painter ??= painterFor(paintCanvas, river);
      return painter !== null;
    };
    let field = wantField();

    let lastDraw = 0;
    let fadeDebt = 0;   // seconds of trail fading not yet applied
    const draw = () => {
      const t0 = performance.now();
      const current = lookRef.current;
      if (wantJitter() !== jitter) {
        jitter = wantJitter();
        worker?.postMessage({ type: "jitter", on: jitter });
      }
      if (wantField() !== field) {
        field = wantField();
        worker?.postMessage({ type: "field", on: field });
      }
      if (painter) {
        const paint = paintLook(current);
        if (paint) {
          painter.render({ scale, dpr, look: paint, visible: current.visible ?? true });
        } else {
          painter.clear();
        }
      }
      // Trails: erase only part of the last frame, so each dot leaves a streak that
      // fades over `trail` seconds. The fade is applied in steps of at least 10%: a
      // smaller step rounds back to the same 8-bit alpha on faint pixels, which then
      // never disappear.
      const trail = current.trail ?? 0;
      let clear = 1;
      if (trail > 0 && lastDraw > 0 && (current.visible ?? true)) {
        fadeDebt += (t0 - lastDraw) / 1000;
        const step = 1 - Math.exp(-fadeDebt / trail);
        clear = step >= 0.1 ? Math.min(1, step) : 0;
        if (clear > 0) fadeDebt = 0;
      }
      lastDraw = t0;
      const colors = current.colors ?? tokens.colors;
      const key = `${colors.join("|")}|${current.buckets}`;
      if (key !== paletteKey) {
        palette = makePalette(ctx, colors, current.buckets);
        paletteKey = key;
      }
      drawDots(ctx, {
        dots: front && new Float32Array(front.buffer, 0, front.count * front.stride),
        count: front ? front.count : 0,
        stride: front ? front.stride : 4,
        tailAges: front?.tailAges,
        scale, dpr, radius: current.radius, fadeIn: current.fadeIn, palette,
        opacity: current.opacity ?? 1, clear,
        // look.dots: false shows the painted water alone.
        visible: (current.visible ?? true) && (current.dots ?? true),
        lines: current.tracers === false ? 0 : current.lines ?? 0,
        brush: current.brush ?? null,
      });
      if (front) pushSample(stats.drawMs, performance.now() - t0);
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      // A display frame at which the worker had not yet returned the last one: the dots
      // then stand still for a frame and jump the next (the tuner shows the share).
      if (pausedRef.current) {
        lastTime = null;   // resume with a normal frame step, not the paused time
      } else if (ready && now >= startAt) {
        pushSample(stats.late, inFlight ? 1 : 0);
      }
      if (ready && now >= startAt && !inFlight && !pausedRef.current) {
        const dt = (lastTime === null ? 1 / 60 : (now - lastTime) / 1000)
          * (lookRef.current.timeScale ?? 1);
        lastTime = now;
        inFlight = true;
        const buffer = spare;
        spare = null;
        worker.postMessage({ type: "frame", dt, buffer }, buffer ? [buffer] : []);
      }
      if (dirty) {
        dirty = false;
        draw();
      }
    };

    const stop = () => {
      disposed = true;
      cancelAnimationFrame(raf);
      worker?.terminate();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      painter?.clear();
    };

    // Any failure: log once, then show the bank only. The page keeps working.
    const fail = (message) => {
      if (disposed) return;
      stats.error = message;
      stop();
      console.error(`[river] ${message}; showing the bank only`);
    };

    // The worker main.jsx started before the first render, if it runs this river
    // (prestart.js); it has been sent `init` already.
    const early = takePrestartedWorker({ river, options, seed });
    try {
      worker = early
        ? early.worker
        : new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    } catch (error) {
      fail(`could not start the worker: ${error.message}`);
      return undefined;
    }
    worker.onmessage = ({ data }) => {
      if (disposed) return;
      if (data.type === "frame") {
        inFlight = false;
        spare = front ? front.buffer : null;
        front = {
          buffer: data.buffer, count: data.count, stride: data.stride, tailAges: data.tailAges,
        };
        if (data.field && painter) {
          painter.setField(data.field);
          painter.advect(data.dt, paintLook(lookRef.current) ?? {});
        }
        dirty = true;
        pushSample(stats.simMs, data.ms);
        if (data.diagnostics) {
          stats.previousDiagnostics = stats.diagnostics;
          stats.previousDiagnosticsAt = stats.diagnosticsAt;
          stats.diagnostics = data.diagnostics;
          stats.diagnosticsAt = performance.now();
        }
      } else if (data.type === "ready") {
        ready = true;
        startAt = performance.now() + 1000 * (lookRef.current.delay ?? 0);
        stats.warmupMs = data.warmupMs;
        stats.start = data.start;
        stats.diagnostics = data.diagnostics;
        stats.diagnosticsAt = performance.now();
        if (import.meta.env.DEV) {
          console.info(`[river] seed ${seed}, ${data.start}, ${Math.round(data.warmupMs)} ms`);
        }
      } else if (data.type === "error") {
        fail(data.message);
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      fail(event.message || "the river worker failed to load");
    };
    worker.onmessageerror = () => fail("a river message could not be read");
    // The backing store follows the CSS size and devicePixelRatio. The dots' box, the
    // canvas's CSS size in page units, goes to the worker; the flow never changes. The
    // box only grows during a river's life: a smaller window (or a shorter page) keeps
    // its dots, clipped out of sight, instead of dropping them and refilling later.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      // Above the reference window the page scale grows with the window (config.js).
      scale = pageScale();
      stats.scale = scale;
      stats.zoom = scale / PAGE_SCALE;
      const next = {
        right: Math.max(view ? view.right : 0, rect.width / scale),
        bottom: Math.max(view ? view.bottom : 0, rect.height / scale),
      };
      if (!view || next.right !== view.right || next.bottom !== view.bottom) {
        const posted = view !== null;
        view = next;
        stats.view = view;
        if (posted) worker.postMessage({ type: "view", ...view });
      }
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    // Browser zoom and moving to another screen change devicePixelRatio, which the
    // ResizeObserver does not always report.
    let dprQuery = null;
    const onDprChange = () => {
      resize();
      watchDpr();
    };
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener("change", onDprChange);
    };
    watchDpr();
    resize();
    if (early) {
      // The prestart used the window's size and the configured look; the canvas and the
      // current look decide from here. Replies it kept are handled now, in order.
      worker.postMessage({ type: "view", ...view });
      worker.postMessage({ type: "jitter", on: jitter });
      worker.postMessage({ type: "field", on: field });
      for (const event of early.messages) worker.onmessage(event);
    } else {
      worker.postMessage({
        type: "init",
        left: river.left.segments,
        right: river.right ? river.right.segments : [],
        width: river.width,
        height: river.height,
        seed,
        options,
        view,
        jitter,
        field,
      });
    }

    const onVisibility = () => {
      lastTime = null;
    };
    document.addEventListener("visibilitychange", onVisibility);

    riverRef.current = {
      stats,
      redraw: () => {
        dirty = true;
      },
      frame: () => front && {
        count: front.count,
        stride: front.stride,
        dots: new Float32Array(front.buffer, 0, front.count * front.stride).slice(),
      },
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stop();
      observer.disconnect();
      dprQuery?.removeEventListener("change", onDprChange);
      document.removeEventListener("visibilitychange", onVisibility);
      riverRef.current = null;
    };
  }, [canvasRef, paintCanvasRef, river, options, seed, enabled]);

  return riverRef;
}
