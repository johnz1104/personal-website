import { placeControls, riverConfig, simulationOptions, windowView } from "./config.js";
import { pickSeed, readPlaying, wantsJitter } from "./useRiverSimulation.js";

// Starts the river's worker as soon as the app's script runs, before React's first
// render (main.jsx), so the WebAssembly download and the hidden warm-up overlap with
// that render instead of waiting for it. The river's hook takes this worker over when
// its river, options and seed match (takePrestartedWorker); otherwise it closes it and
// starts its own, as without a prestart.
//
// Only the homepage group has a river (config.js), so only its pages prestart, and
// only when the river will run (the Flow toggle on, see readPlaying). These paths
// mirror the home group's routes in App.jsx.
const HOME_PATHS = new Set(["/", "/research", "/projects", "/about"]);

let early = null;   // { worker, river, options, seed, messages }

export function prestartRiver() {
  const path = window.location.pathname.replace(/(.)\/$/, "$1");
  if (!HOME_PATHS.has(path) || !readPlaying()) return;
  const config = riverConfig.home;
  // The same values RiverLayout and RiverDots compute on their first render.
  const options = simulationOptions(
    config.options,
    placeControls(config.controls, windowView()),
  );
  const seed = pickSeed();
  let worker;
  try {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  } catch {
    return;   // the hook tries again and reports the failure
  }
  // Replies that arrive before the hook takes the worker over wait here.
  const messages = [];
  worker.onmessage = (event) => messages.push(event);
  worker.onerror = (event) => {
    event.preventDefault();
    messages.push({ data: { type: "error", message: event.message || "the river worker failed to load" } });
  };
  worker.postMessage({
    type: "init",
    left: config.river.left.segments,
    right: config.river.right ? config.river.right.segments : [],
    width: config.river.width,
    height: config.river.height,
    seed,
    options,
    view: windowView(),
    jitter: wantsJitter(config.look),
  });
  early = { worker, river: config.river, options, seed, messages };
}

// The prestarted river's seed, for RiverDots to start with (null if none).
export function prestartedSeed() {
  return early ? early.seed : null;
}

// The prestarted worker, if it runs this river with these options and seed, and the
// replies it has sent so far; null otherwise. Either way it is handed out only once:
// a worker that does not match is closed.
export function takePrestartedWorker({ river, options, seed }) {
  const taken = early;
  early = null;
  if (!taken) return null;
  if (taken.river !== river || taken.options !== options || taken.seed !== seed) {
    taken.worker.terminate();
    return null;
  }
  taken.worker.onmessage = null;
  taken.worker.onerror = null;
  return { worker: taken.worker, messages: taken.messages };
}
