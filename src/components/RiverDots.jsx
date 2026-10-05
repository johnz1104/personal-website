import { lazy, Suspense, useRef, useState } from "react";
import { pickFlow, pickLook, simulationOptions } from "../river/sim/config.js";
import { prestartedSeed } from "../river/sim/prestart.js";
import { pickSeed, useRiverSimulation } from "../river/sim/useRiverSimulation.js";

// The tuning panel exists only in dev builds; production builds drop this import.
const RiverTuner = import.meta.env.DEV ? lazy(() => import("./RiverTuner.jsx")) : null;

// The river's moving dots, drawn on a canvas under the bank line and the page
// content. One river per mount: it keeps running while this layout stays mounted.
// `playing` is the visitor's "Flow" toggle: off freezes the dots where they are. A
// river that has never been on (the visitor turned it off earlier, or asks for reduced
// motion) has not started: only the bank shows, and no worker runs.
// In dev, /?tune opens the tuning panel, which can override the group's config.
// `controls` is the Flow box as placed for this window: the simulation makes it solid.
function RiverDots({ river, group, config, controls, playing }) {
  const canvasRef = useRef(null);
  const paintCanvasRef = useRef(null);
  const [started, setStarted] = useState(playing);
  if (playing && !started) setStarted(true);
  // The seed of the river main.jsx may have started already (prestart.js).
  const [seed, setSeed] = useState(() => prestartedSeed() ?? pickSeed());
  // idea-painted-river: ?look= and ?flow= pick one of the looks and flows to compare.
  const [settings, setSettings] = useState(() => ({
    options: pickFlow(config.options), look: pickLook(config.look),
  }));
  const [tuning] = useState(
    () => RiverTuner !== null && new URLSearchParams(window.location.search).has("tune"),
  );
  const riverRef = useRiverSimulation({
    canvasRef,
    paintCanvasRef,
    river,
    options: simulationOptions(settings.options, controls),
    look: settings.look,
    seed,
    enabled: started,
    paused: !playing,
  });
  return (
    <>
      {started && <canvas ref={paintCanvasRef} className="river-paint" aria-hidden="true" />}
      {started && <canvas ref={canvasRef} className="river-dots" aria-hidden="true" />}
      {tuning && (
        <Suspense fallback={null}>
          <RiverTuner
            group={group}
            riverRef={riverRef}
            settings={settings}
            defaults={config}
            onApply={(options) => setSettings((s) => ({ ...s, options }))}
            onLook={(look) => setSettings((s) => ({ ...s, look }))}
            onNewSeed={() => setSeed(pickSeed())}
          />
        </Suspense>
      )}
    </>
  );
}

export default RiverDots;
