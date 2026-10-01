import saved from "./generated/flows/index.js";

// Saved flows: the page river's developed flow at five moments of one long run
// (`npm run build:flows`, fluids/lbm/tools/export-river-flows.mjs). The worker starts
// from one of them, picked at random, instead of running the hidden warm-up, so the
// flow shows as soon as the module loads. The river's seed stays random, so the
// flows part within seconds. A river whose settings or banks differ from the saved
// run (the tuner's) runs the warm-up as before.
//
// File layout, little-endian: "RVF1", nx and ny (uint16), the velocity and density
// steps (float32), then three int16 planes of nx * ny cells, row-major: density - 1,
// x velocity, y velocity, each in its step (lattice units). NOT_WATER in the density
// plane marks a cell that is not water.
const MAGIC = "RVF1";
const HEADER_BYTES = 16;
const NOT_WATER = -32768;
const FULL = 32767;

// The options a saved flow must match. Two are left out:
// - the Flow box's position (box*), which varies with the window: a start from a flow
//   saved with the box elsewhere only moves its wake;
// - `speed`, the inflow in page units per second: the saved velocities are in lattice
//   units, which `speed` does not change (the lattice speed does), so it only sets how
//   fast the same flow plays on screen. Speeds given in page units (the side flow, the
//   corner jet) then differ a little relative to the inflow, and the flow adjusts to
//   that within seconds (the author chose speed 50 on flows saved at 45, 2026-09-30).
export function flowOptions(options) {
  return options
    .split(/\s+/)
    .filter((token) => token && !/^(box[XYWH]|speed)=/.test(token))
    .join(" ");
}

// A short fingerprint of the river's geometry (banks and size).
export function riverKey({ left, right = [], width, height }) {
  const text = JSON.stringify([left, right, width, height]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// Which saved flow to start from (0-based, at random), or null when the saved run
// does not match this river.
export function pickSavedFlow({ left, right, width, height, options }) {
  if (saved.count === 0 || flowOptions(options) !== flowOptions(saved.options)) return null;
  if (riverKey({ left, right, width, height }) !== saved.river) return null;
  return Math.floor(Math.random() * saved.count);
}

// Fetches saved flow `index` and decodes it; null if it cannot be loaded.
export async function loadSavedFlow(index) {
  try {
    const response = await fetch(new URL(`./generated/flows/flow-${index + 1}.bin`, import.meta.url));
    if (!response.ok) return null;
    return decodeFlow(await response.arrayBuffer());
  } catch {
    return null;
  }
}

// flow: Float32Array of 3 * nx * ny (RiverSimulation::exportFlow's layout).
export function encodeFlow(flow, nx, ny) {
  const cells = nx * ny;
  let uMax = 0;
  let rhoMax = 0;
  for (let i = 0; i < cells; i++) {
    if (Number.isNaN(flow[i])) continue;
    rhoMax = Math.max(rhoMax, Math.abs(flow[i] - 1));
    uMax = Math.max(uMax, Math.abs(flow[cells + i]), Math.abs(flow[2 * cells + i]));
  }
  const uStep = uMax / FULL || 1;
  const rhoStep = rhoMax / FULL || 1;
  const buffer = new ArrayBuffer(HEADER_BYTES + 6 * cells);
  const header = new DataView(buffer);
  for (let i = 0; i < 4; i++) header.setUint8(i, MAGIC.charCodeAt(i));
  header.setUint16(4, nx, true);
  header.setUint16(6, ny, true);
  header.setFloat32(8, uStep, true);
  header.setFloat32(12, rhoStep, true);
  const planes = new Int16Array(buffer, HEADER_BYTES, 3 * cells);
  for (let i = 0; i < cells; i++) {
    if (Number.isNaN(flow[i])) {
      planes[i] = NOT_WATER;
      continue;
    }
    planes[i] = Math.round((flow[i] - 1) / rhoStep);
    planes[cells + i] = Math.round(flow[cells + i] / uStep);
    planes[2 * cells + i] = Math.round(flow[2 * cells + i] / uStep);
  }
  return buffer;
}

// Returns { nx, ny, flow } (flow in exportFlow's layout), or null if not a saved flow.
export function decodeFlow(buffer) {
  if (buffer.byteLength < HEADER_BYTES) return null;
  const header = new DataView(buffer);
  let magic = "";
  for (let i = 0; i < 4; i++) magic += String.fromCharCode(header.getUint8(i));
  if (magic !== MAGIC) return null;
  const nx = header.getUint16(4, true);
  const ny = header.getUint16(6, true);
  const uStep = header.getFloat32(8, true);
  const rhoStep = header.getFloat32(12, true);
  const cells = nx * ny;
  if (buffer.byteLength !== HEADER_BYTES + 6 * cells) return null;
  const planes = new Int16Array(buffer, HEADER_BYTES, 3 * cells);
  const flow = new Float32Array(3 * cells);
  for (let i = 0; i < cells; i++) {
    if (planes[i] === NOT_WATER) {
      flow[i] = NaN;
      continue;
    }
    flow[i] = 1 + planes[i] * rhoStep;
    flow[cells + i] = planes[cells + i] * uStep;
    flow[2 * cells + i] = planes[2 * cells + i] * uStep;
  }
  return { nx, ny, flow };
}
