// The river's Web Worker, and the small wrapper around the WebAssembly C API
// (fluids/lbm/wasm/bindings.cpp) that it runs. The Node tests import the wrapper
// from this file too, so they exercise the same code as the page.
//
// Messages from the page (src/river/sim/useRiverSimulation.js):
//   { type: "init", left, right, width, height, seed, options, view }
//       left, right: the banks' { y0, y1, a, b, c, d } pieces (right may be empty:
//       a straight wall at x = width); seed: BigInt; options: key=value list
//       (fluids/lbm/include/lbm/RiverOptions.hpp); view: { right, bottom } or null
//   { type: "view", right, bottom }
//       the visible box in page units changed (a resize); the flow is untouched
//   { type: "jitter", on }
//       the dots' random walk on or off (off while tracer lines are drawn); the flow
//       is untouched. init also takes `jitter` (default on).
//   { type: "frame", dt, buffer }
//       advance by dt seconds (at most MAX_FRAME_SECONDS), then return the dots in
//       `buffer`, an ArrayBuffer to reuse (or null)
// Replies:
//   { type: "ready", warmupMs, start, diagnostics }
//       start: "saved flow N" (1-5; flows.js) or "warm-up"; warmupMs: the time the
//       start took (decoding and loading a saved flow, or the hidden warm-up)
//   { type: "frame", buffer, count, stride, tailAges, ms, diagnostics }
//       buffer holds `count` dots of `stride` floats: x, y, tone, age, then the dot's
//       tail (past positions, newest first; see bindings.cpp). The count includes dots
//       that have just left, drawn until their tails follow them out. tailAges: the
//       tail samples' ages in seconds (the same for every dot). ms is the time spent on
//       this frame; diagnostics about twice a second, otherwise null
//   { type: "error", message }
// The page stops a river with worker.terminate(), which also interrupts a warm-up
// in progress (a "dispose" message would wait behind it).

import createLbmModule from "./generated/lbm.js";
import { loadSavedFlow, pickSavedFlow } from "./flows.js";

// A hidden tab or a stall never makes the river catch up in one burst.
export const MAX_FRAME_SECONDS = 0.05;
const DIAGNOSTICS_INTERVAL_MS = 500;

// The order written by river_diagnostics() in bindings.cpp.
export const DIAGNOSTIC_FIELDS = [
  "time", "steps", "stepsPerSecond", "inflow", "outflow", "targetFlux", "maxMach",
  "maxDensityDeviation", "maxTauEffective", "finite", "dots", "expectedDots", "nx",
  "ny", "fluidNodes", "tau",
];

export function loadRiverModule() {
  return createLbmModule();
}

// Creates the module's river (replacing any previous one) between the `left` bank and
// the `right` bank, or a straight right wall at x = width when `right` is empty.
// Throws an Error with the solver's message on a bad option or bank; the module stays
// usable.
export function createRiver(lbm, { left, right = [], width, height, seed = 1n, options = "" }) {
  const seed64 = BigInt.asUintN(64, BigInt(seed));
  const flat = (bank) => bank.flatMap(({ y0, y1, a, b, c, d }) => [y0, y1, a, b, c, d]);
  const leftPtr = lbm._malloc(left.length * 6 * 8);
  const rightPtr = lbm._malloc(Math.max(1, right.length) * 6 * 8);
  const optBytes = lbm.lengthBytesUTF8(options) + 1;
  const optPtr = lbm._malloc(optBytes);
  let status;
  try {
    lbm.HEAPF64.set(flat(left), leftPtr / 8);
    lbm.HEAPF64.set(flat(right), rightPtr / 8);
    lbm.stringToUTF8(options, optPtr, optBytes);
    status = lbm._river_create(
      leftPtr, left.length, rightPtr, right.length, width, height,
      Number(seed64 & 0xffffffffn), Number(seed64 >> 32n), optPtr,
    );
  } finally {
    lbm._free(leftPtr);
    lbm._free(rightPtr);
    lbm._free(optPtr);
  }
  if (status !== 0) throw new Error(lbm.UTF8ToString(lbm._river_last_error()));

  const diagPtr = lbm._malloc(DIAGNOSTIC_FIELDS.length * 8);
  return {
    seed: seed64,
    warmUp: () => lbm._river_warm_up(),
    // The flow on the full grid (RiverSimulation::exportFlow): a Float32Array copy.
    exportFlow() {
      const { nx, ny } = this.diagnostics();
      const ptr = lbm._malloc(3 * nx * ny * 4);
      try {
        lbm._river_export_flow(ptr);
        return Float32Array.from(lbm.HEAPF32.subarray(ptr / 4, ptr / 4 + 3 * nx * ny));
      } finally {
        lbm._free(ptr);
      }
    },
    // Start from a saved flow ({ nx, ny, flow }, flows.js) instead of the warm-up.
    // Throws if the grid differs or the river has already started.
    startFromFlow({ nx, ny, flow }) {
      const d = this.diagnostics();
      if (nx !== d.nx || ny !== d.ny) throw new Error(`saved flow is ${nx} x ${ny}, river ${d.nx} x ${d.ny}`);
      const ptr = lbm._malloc(flow.byteLength);
      try {
        lbm.HEAPF32.set(flow, ptr / 4);
        if (lbm._river_start_from_flow(ptr) !== 0) throw new Error(lbm.UTF8ToString(lbm._river_last_error()));
      } finally {
        lbm._free(ptr);
      }
    },
    // Only x <= right, y <= bottom (page units) is shown; see bindings.cpp.
    setView: (viewRight, viewBottom) => lbm._river_set_view(viewRight, viewBottom),
    advance: (seconds) => lbm._river_advance(seconds),
    // The dots' random walk on or off; the flow is never touched.
    setDotJitter: (on) => lbm._river_set_dot_jitter(on ? 1 : 0),
    dotCount: () => lbm._river_dot_count(),
    // Floats per dot in dots(): x, y, tone, age, then the tail.
    dotStride: () => lbm._river_dot_stride(),
    // The tail samples' ages in seconds, newest first (a copy).
    tailAges() {
      const samples = (lbm._river_dot_stride() - 4) / 2;
      const ptr = lbm._river_tail_ages() / 4;
      return Float32Array.from(lbm.HEAPF32.subarray(ptr, ptr + samples));
    },
    // A view into module memory: copy it before the next call into the module.
    dots() {
      const count = lbm._river_dot_count();
      const ptr = lbm._river_dots() / 4;
      return lbm.HEAPF32.subarray(ptr, ptr + lbm._river_dot_stride() * count);
    },
    diagnostics() {
      lbm._river_diagnostics(diagPtr);
      const values = lbm.HEAPF64.subarray(diagPtr / 8, diagPtr / 8 + DIAGNOSTIC_FIELDS.length);
      const out = Object.fromEntries(DIAGNOSTIC_FIELDS.map((name, i) => [name, values[i]]));
      out.finite = out.finite === 1;
      return out;
    },
    destroy() {
      lbm._river_destroy();
      lbm._free(diagPtr);
    },
  };
}

function runWorker() {
  let river = null;
  let lastDiagnostics = 0;
  // The latest visible box; a resize can arrive while the module is still loading.
  let view = null;
  let jitter = true;

  async function init(data) {
    // A saved flow that matches this river loads while the module does.
    const index = pickSavedFlow(data);
    const [lbm, saved] = await Promise.all([
      loadRiverModule(),
      index === null ? null : loadSavedFlow(index),
    ]);
    river = createRiver(lbm, data);
    view ??= data.view;
    if (view) river.setView(view.right, view.bottom);
    if (data.jitter === false) jitter = false;
    river.setDotJitter(jitter);
    const t0 = performance.now();
    let start = "warm-up";
    if (saved) {
      try {
        river.startFromFlow(saved);
        start = `saved flow ${index + 1}`;
      } catch {
        // A grid that does not match: warm up instead.
      }
    }
    if (start === "warm-up") river.warmUp();
    const warmupMs = performance.now() - t0;
    lastDiagnostics = performance.now();
    self.postMessage({ type: "ready", warmupMs, start, diagnostics: river.diagnostics() });
  }

  function frame({ dt, buffer }) {
    const t0 = performance.now();
    river.advance(Math.min(Math.max(dt, 0), MAX_FRAME_SECONDS));
    const dots = river.dots();
    if (!buffer || buffer.byteLength < dots.byteLength) {
      // Headroom, so the buffer is not reallocated on every new dot.
      buffer = new ArrayBuffer(Math.max(16384, Math.ceil(dots.byteLength * 1.25 / 16) * 16));
    }
    new Float32Array(buffer, 0, dots.length).set(dots);
    const ms = performance.now() - t0;
    let diagnostics = null;
    if (t0 - lastDiagnostics >= DIAGNOSTICS_INTERVAL_MS) {
      lastDiagnostics = t0;
      diagnostics = river.diagnostics();
      if (!diagnostics.finite) throw new Error("the river became non-finite");
    }
    const stride = river.dotStride();
    self.postMessage(
      { type: "frame", buffer, count: dots.length / stride, stride, tailAges: river.tailAges(), ms, diagnostics },
      [buffer],
    );
  }

  self.onmessage = async ({ data }) => {
    try {
      if (data.type === "init") await init(data);
      else if (data.type === "frame" && river) frame(data);
      else if (data.type === "view") {
        view = { right: data.right, bottom: data.bottom };
        river?.setView(view.right, view.bottom);
      } else if (data.type === "jitter") {
        jitter = data.on;
        river?.setDotJitter(jitter);
      }
    } catch (error) {
      river = null;
      self.postMessage({ type: "error", message: String(error?.message ?? error) });
    }
  };
}

if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) runWorker();
