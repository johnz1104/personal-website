import { useEffect, useState } from "react";
import { LOOKS } from "../river/sim/config.js";
import { readDotColors } from "../river/sim/draw.js";
import { PAINT_DEFAULTS } from "../river/sim/paint.js";

// Dev-only tuning panel for the river: `npm run dev`, then open /?tune. RiverDots
// loads it with a dynamic import behind import.meta.env.DEV, so production builds
// leave it out.
//
// Simulation fields restart the river on "Apply"; an empty field keeps the
// validated default shown as its placeholder (the native RiverParams defaults, for
// display only). The dot look applies immediately. "Copy config" gives an entry
// for src/river/sim/config.js; "Export frame" downloads the current dots as JSON.

const SIM_FIELDS = [
  { key: "cell", label: "cell size", hint: "rows 112", unit: "units" },
  { key: "lattice", label: "lattice speed", hint: "0.015" },
  { key: "speed", label: "speed", hint: "30", unit: "units/s" },
  // Start-up: simulated seconds run hidden before the dots appear, and over which the
  // inflow rises from rest. Used only when no saved flow matches (flows.js): any
  // applied change to these fields starts the river with the warm-up.
  { key: "warmup", label: "hidden warm-up", hint: "7", unit: "s" },
  { key: "ramp", label: "inflow ramp-up", hint: "6", unit: "s" },
  { key: "spacing", label: "dot spacing", hint: "22", unit: "units" },
  { key: "re", label: "Reynolds", hint: "1000" },
  { key: "rows", label: "rows", hint: "112" },
  { key: "smag", label: "Smagorinsky", hint: "0.12" },
  { key: "stir", label: "stirring", hint: "0", choices: ["0", "1"] },
  { key: "stirIntensity", label: "stir intensity", hint: "0.15" },
  { key: "inflowNoise", label: "inflow noise", hint: "1", choices: ["0", "1"] },
  { key: "meander", label: "meander", hint: "1", choices: ["0", "1"] },
  { key: "inflowAmplitude", label: "inflow unevenness", hint: "0.15", unit: "0–1" },
  { key: "inflowModes", label: "inflow lanes", hint: "3", unit: "1–8" },
  { key: "inflowFloor", label: "slowest lane", hint: "0.3", unit: "× mean" },
  { key: "diffusivity", label: "dot diffusivity", hint: "1", unit: "units²/s" },
  // The push (PushParams in fluids/lbm/include/lbm/River.hpp); by default it drives
  // a swirl into the pocket behind the left bank's upper bend.
  { key: "push", label: "push strength", hint: "0 (off)", unit: "inlet speeds/s" },
  { key: "pushPulse", label: "push pulse", hint: "0 (steady)", unit: "0–1" },
  { key: "pushPeriod", label: "push period", hint: "4", unit: "s" },
  { key: "pushX", label: "push centre x", hint: "1000" },
  { key: "pushY", label: "push centre y", hint: "110" },
  { key: "pushRadius", label: "push radius", hint: "80" },
  { key: "pushAimX", label: "push aim x", hint: "880" },
  { key: "pushAimY", label: "push aim y", hint: "320" },
  // The designed edges (SideInflowParams): a side jet across the right edge.
  { key: "side", label: "side inflow", hint: "0", choices: ["0", "1"] },
  { key: "sideTop", label: "side jet top y", hint: "500" },
  { key: "sideBottom", label: "side jet bottom y", hint: "page bottom" },
  { key: "sideSpeed", label: "side jet speed", hint: "30", unit: "units/s" },
  { key: "sideAngle", label: "side jet tilt up", hint: "20", unit: "°" },
  { key: "sideOutlet", label: "right edge above jet", hint: "1 (outlet)", choices: ["0", "1"] },
  { key: "sideOutletBottom", label: "right outlet ends at y", hint: "jet top" },
  { key: "topOutlet", label: "top outlet", hint: "1", choices: ["0", "1"] },
  { key: "outletRight", label: "top outlet ends at x", hint: "no lid" },
  // The bottom-left corner jet (CornerJetParams): faster inflow next to the bank.
  { key: "cornerJet", label: "corner jet width", hint: "0 (off)", unit: "units" },
  { key: "cornerSpeed", label: "corner jet speed", hint: "80", unit: "units/s" },
  { key: "cornerAngle", label: "corner jet tilt right", hint: "45", unit: "°" },
  { key: "cornerEdge", label: "corner jet edge", hint: "30", unit: "units" },
  // Converging inflow (ConvergeParams): the inflow tilts toward a focus point.
  { key: "converge", label: "converging inflow", hint: "0", choices: ["0", "1"] },
  { key: "convergeX", label: "focus x", hint: "1450" },
  { key: "convergeY", label: "focus y", hint: "-300 (above page)" },
  { key: "convergeMax", label: "max tilt", hint: "45", unit: "°" },
  { key: "sideConverge", label: "side jet aims at focus", hint: "0", choices: ["0", "1"] },
  // The hidden bed (DepthParams): depth acts as bottom drag, bedDrag / depth². Layers:
  // inflow (1), the upper curve (2), the outflow (3); a shallow sill where 1 meets 3.
  { key: "depth", label: "hidden bed", hint: "0", choices: ["0", "1"] },
  { key: "bedDrag", label: "bed drag at depth 1", hint: "0.15", unit: "1/s" },
  { key: "depth1", label: "depth: inflow", hint: "1" },
  { key: "depth2", label: "depth: upper curve", hint: "2" },
  { key: "depth3", label: "depth: outflow", hint: "3" },
  { key: "sillDepth", label: "sill depth", hint: "0.02" },
  { key: "sillWidth", label: "sill width", hint: "100 (0 = none)", unit: "units" },
  { key: "sillX", label: "sill tip x", hint: "1250" },
  { key: "sillY", label: "sill y", hint: "420" },
  { key: "curveBottom", label: "curve layer bottom y", hint: "650" },
  { key: "stepWidth", label: "depth step width", hint: "40", unit: "units" },
  // Dots seeded in the swirl when the dots start (FillParams).
  { key: "fill", label: "fill radius", hint: "0 (off)", unit: "units" },
  { key: "fillX", label: "fill centre x", hint: "1010" },
  { key: "fillY", label: "fill centre y", hint: "210" },
  { key: "fillHold", label: "fill hold", hint: "0 (once)", unit: "s" },
];
const SIM_KEYS = new Set(SIM_FIELDS.map((f) => f.key));

// "a=1 b=2" -> { fields: { a: "1", b: "2" } for the known keys, other: the rest }.
function parseOptions(options) {
  const fields = {};
  const other = [];
  for (const item of options.split(/[\s,]+/).filter(Boolean)) {
    const [key, ...rest] = item.split("=");
    if (SIM_KEYS.has(key)) fields[key] = rest.join("=");
    else other.push(item);
  }
  return { fields, other: other.join(" ") };
}

function joinOptions(fields, other) {
  const items = SIM_FIELDS.filter((f) => fields[f.key]?.trim()).map(
    (f) => `${f.key}=${fields[f.key].trim()}`,
  );
  if (other.trim()) items.push(other.trim());
  return items.join(" ");
}

function cssColorToHex(value) {
  const canvas = document.createElement("canvas").getContext("2d");
  canvas.fillStyle = value;
  return canvas.fillStyle.startsWith("#") ? canvas.fillStyle : "#000000";
}

function summarize(samples) {
  if (!samples.length) return { mean: NaN, p95: NaN };
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    p95: sorted[Math.floor(0.95 * (sorted.length - 1))],
  };
}

const fmt = (value, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : "–");

function readout(river) {
  const stats = river?.stats;
  if (!stats) return [["river", "not running"]];
  if (stats.error) return [["error", stats.error]];
  const d = stats.diagnostics;
  const p = stats.previousDiagnostics;
  const wall = (stats.diagnosticsAt - stats.previousDiagnosticsAt) / 1000;
  const sim = summarize(stats.simMs);
  const draw = summarize(stats.drawMs);
  if (!d) return [["seed", String(stats.seed)], ["status", "warming up…"]];
  return [
    ["seed", String(stats.seed)],
    ["simulated time", `${fmt(d.time, 1)} s` + (p && wall > 0 ? ` (×${fmt((d.time - p.time) / wall)} real time)` : "")],
    ["lattice steps/s", `${fmt(d.stepsPerSecond, 0)} per simulated s` + (p && wall > 0 ? `, ${fmt((d.steps - p.steps) / wall, 0)} per wall s` : "")],
    ["worker ms/frame", `mean ${fmt(sim.mean)}, p95 ${fmt(sim.p95)} (last ${stats.simMs.length})`],
    ["draw ms/frame", `mean ${fmt(draw.mean)}, p95 ${fmt(draw.p95)}`],
    ["late frames", stats.late.length
      ? `${fmt(100 * summarize(stats.late).mean, 1)}% (worker not back in time)` : "–"],
    ["start", stats.start ?? "–"],
    ["start time", stats.warmupMs === null ? "–" : `${fmt(stats.warmupMs, 0)} ms`],
    ["view", stats.view ? `${fmt(stats.view.right, 0)} × ${fmt(stats.view.bottom, 0)} page units` : "–"],
    ["page zoom", stats.zoom ? `${fmt(stats.zoom)} (${fmt(stats.scale, 3)} CSS px per unit)` : "–"],
    ["dots in view", `${d.dots} of ${fmt(d.expectedDots, 0)} expected (${fmt((100 * d.dots) / d.expectedDots, 0)}%)`],
    ["max Mach", fmt(d.maxMach, 3)],
    ["max |δρ|/ρ₀", fmt(d.maxDensityDeviation, 4)],
    ["inflow / outflow", `${fmt(d.inflow, 0)} / ${fmt(d.outflow, 0)} (target ${fmt(d.targetFlux, 0)})`],
    ["finite", d.finite ? "yes" : "NO"],
    ["lattice", `${d.nx} × ${d.ny}, ${d.fluidNodes} fluid nodes, τ ${fmt(d.tau, 5)}`],
  ];
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const styles = {
  panel: {
    position: "fixed",
    bottom: 16,
    zIndex: 10,
    width: 360,
    maxHeight: "calc(100vh - 32px)",
    overflowY: "auto",
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    boxShadow: "4px 4px 0 var(--color-shadow)",
    font: "12px/1.4 var(--font-mono)",
    color: "var(--color-text)",
    padding: "8px 10px",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  grid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "3px 8px",
    alignItems: "center",
    margin: "6px 0",
  },
  input: { font: "inherit", width: "100%", boxSizing: "border-box", minWidth: 0 },
  buttons: { display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0" },
  section: { fontWeight: "bold", marginTop: 8 },
  dim: { color: "var(--color-muted)" },
};

// idea-painted-river: the painted look's settings (paint.js, drawBrushes in draw.js).
// The sliders set look.paint and look.brush overrides; "Copy config" includes them.
const PAINT_SLIDERS = [
  { key: "opacity", label: "water opacity", min: 0, max: 1, step: 0.05 },
  { key: "washAlpha", label: "wash between strokes", min: 0, max: 1, step: 0.05 },
  { key: "strokeAlpha", label: "stroke strength", min: 0, max: 1, step: 0.05 },
  { key: "coverage", label: "strokes in currents", min: 0, max: 0.8, step: 0.02 },
  { key: "calm", label: "strokes in slow water", min: 0, max: 1, step: 0.05 },
  { key: "contrast", label: "stroke contrast", min: 0.5, max: 5, step: 0.1 },
  { key: "soft", label: "soft stroke edges", min: 0.005, max: 0.2, step: 0.005 },
  { key: "depth", label: "deeper colour when fast", min: 0, max: 1, step: 0.05 },
  { key: "noiseScale", label: "stroke width (units)", min: 1.5, max: 10, step: 0.1 },
  { key: "step", label: "stroke length (units/step)", min: 0.8, max: 5, step: 0.1 },
  { key: "period", label: "repaint period (sim s)", min: 0.5, max: 10, step: 0.25 },
  { key: "highlights", label: "glints", min: 0, max: 1.5, step: 0.05 },
  { key: "lumaMatch", label: "colour over lightness", min: 0, max: 1, step: 0.05 },
  { key: "vRef", label: "full strokes from (units/s)", min: 2, max: 60, step: 1 },
  { key: "shore", label: "shallow band", min: 0, max: 1, step: 0.05 },
  { key: "shoreWidth", label: "shallow band width (units)", min: 4, max: 128, step: 2 },
  { key: "nearWidth", label: "strokes fade at bank (units)", min: 2, max: 64, step: 1 },
  { key: "edge", label: "pooling at bank", min: 0, max: 0.4, step: 0.02 },
  { key: "grain", label: "paper grain", min: 0, max: 0.2, step: 0.01 },
  { key: "resolution", label: "resolution (px per CSS px)", min: 0.5, max: 2, step: 0.25 },
];
const PAINT_COLORS = [
  { key: "washSlow", label: "wash, slow water" },
  { key: "washFast", label: "wash, fast water" },
  { key: "shallow", label: "shallow band" },
  { key: "highlight", label: "glints" },
];

function PaintedLook({ look, onLook }) {
  const [preset, setPreset] = useState("");
  const paint = look.paint ? { ...PAINT_DEFAULTS, ...(look.paint === true ? {} : look.paint) } : null;
  const setPaint = (key, value) =>
    onLook({ ...look, paint: { ...(look.paint === true ? {} : look.paint), [key]: value } });
  const brush = look.brush ?? null;
  const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  return (
    <>
      <div style={styles.section}>painted look (idea-painted-river)</div>
      <div style={styles.grid}>
        <label style={{ display: "contents" }}>
          <span style={styles.dim}>preset</span>
          <select
            style={styles.input}
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              if (LOOKS[e.target.value]) onLook(LOOKS[e.target.value]);
            }}
          >
            <option value="">choose…</option>
            {Object.keys(LOOKS).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label style={{ display: "contents" }}>
          <span style={styles.dim}>slow motion (× real time)</span>
          <input
            style={styles.input}
            type="number"
            min="0.1"
            max="1.5"
            step="0.05"
            value={look.timeScale ?? 1}
            onChange={(e) => onLook({ ...look, timeScale: Math.min(1.5, Math.max(0.1, number(e.target.value, 1))) })}
          />
        </label>
        <label style={{ display: "contents" }}>
          <span style={styles.dim}>dots shown</span>
          <input
            type="checkbox"
            checked={look.dots ?? true}
            onChange={(e) => onLook({ ...look, dots: e.target.checked })}
          />
        </label>
        <label style={{ display: "contents" }}>
          <span style={styles.dim}>dots as brush strokes</span>
          <input
            type="checkbox"
            checked={brush !== null}
            onChange={(e) => onLook({
              ...look,
              brush: e.target.checked ? { width: 1.5, taper: 0.8, bristles: 0.45, glints: 0.06 } : null,
            })}
          />
        </label>
        {brush && (
          <>
            <Slider label="stroke width (× radius)" min={0.5} max={3} step={0.1} value={brush.width ?? 1.6}
              onChange={(v) => onLook({ ...look, brush: { ...brush, width: v } })} />
            <Slider label="taper" min={0} max={1} step={0.05} value={brush.taper ?? 0.75}
              onChange={(v) => onLook({ ...look, brush: { ...brush, taper: v } })} />
            <Slider label="bristle streaks" min={0} max={1} step={0.05} value={brush.bristles ?? 0}
              onChange={(v) => onLook({ ...look, brush: { ...brush, bristles: v } })} />
            <Slider label="glint dots (share)" min={0} max={0.3} step={0.01} value={brush.glints ?? 0}
              onChange={(v) => onLook({ ...look, brush: { ...brush, glints: v } })} />
          </>
        )}
        <label style={{ display: "contents" }}>
          <span style={styles.dim}>painted water</span>
          <input
            type="checkbox"
            checked={paint !== null}
            onChange={(e) => onLook({ ...look, paint: e.target.checked })}
          />
        </label>
        {paint && PAINT_SLIDERS.map((f) => (
          <Slider key={f.key} label={f.label} min={f.min} max={f.max} step={f.step} value={paint[f.key]}
            onChange={(v) => setPaint(f.key, v)} />
        ))}
        {paint && PAINT_COLORS.map((f) => (
          <label key={f.key} style={{ display: "contents" }}>
            <span style={styles.dim}>{f.label}</span>
            <input type="color" value={paint[f.key]} onChange={(e) => setPaint(f.key, e.target.value)} />
          </label>
        ))}
        {paint && paint.colors.map((color, i) => (
          <label key={`pigment-${i}`} style={{ display: "contents" }}>
            <span style={styles.dim}>pigment {i + 1}{i === 0 ? " (deepest)" : ""}</span>
            <input
              type="color"
              value={color}
              onChange={(e) => {
                const next = [...paint.colors];
                next[i] = e.target.value;
                setPaint("colors", next);
              }}
            />
          </label>
        ))}
      </div>
    </>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <label style={{ display: "contents" }}>
      <span style={styles.dim}>{label}</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ flex: 1, minWidth: 0 }}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span style={{ width: 34, textAlign: "right" }}>{value}</span>
      </span>
    </label>
  );
}

function RiverTuner({ group, riverRef, settings, defaults, onApply, onLook, onNewSeed }) {
  const [open, setOpen] = useState(true);
  // The panel can cover the cards or the river; "move" switches corners.
  const [side, setSide] = useState("left");
  const [draft, setDraft] = useState(() => parseOptions(settings.options));
  const [colors] = useState(() => {
    const style = getComputedStyle(document.documentElement);
    return readDotColors(style).map(cssColorToHex);
  });
  const [rows, setRows] = useState([["river", "starting…"]]);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const update = () => setRows(readout(riverRef.current));
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [riverRef]);

  const options = joinOptions(draft.fields, draft.other);
  const look = settings.look;
  const setField = (key, value) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));
  const setLook = (key, value) => onLook({ ...look, [key]: value });

  const copyConfig = async () => {
    const lookText = Object.entries(look)
      .map(([k, v]) => `${k}: ${typeof v === "number" || typeof v === "boolean" ? v : JSON.stringify(v)}`)
      .join(", ");
    const text =
      `  ${group}: {\n    river: pageRiver,\n    options: ${JSON.stringify(settings.options)},\n` +
      `    look: { ${lookText} },\n  },\n`;
    setCopied(text);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // The text is shown below the buttons to copy by hand.
    }
  };

  const exportFrame = () => {
    const river = riverRef.current;
    const frame = river?.frame();
    if (!frame) return;
    const dots = [];
    for (let i = 0; i < frame.count; i++) {
      const at = frame.stride * i;   // x, y, tone, age (the tail is left out)
      dots.push(Array.from(frame.dots.subarray(at, at + 4), (v) => Math.round(v * 1000) / 1000));
    }
    const time = river.stats.diagnostics?.time ?? null;
    const data = {
      group,
      seed: String(river.stats.seed),
      options: river.stats.options,
      look,
      time,
      frame: "dots are [x, y, tone, age] in reference units (1440 x 900, y down) and seconds",
      count: frame.count,
      dots,
    };
    download(`river-frame-${river.stats.seed}-${fmt(time ?? 0, 1)}s.json`, JSON.stringify(data));
  };

  return (
    <aside style={{ ...styles.panel, [side]: 16 }} aria-label="River tuning panel">
      <div style={styles.header}>
        <strong>river tuner · {group}</strong>
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setSide(side === "left" ? "right" : "left")}>
            move
          </button>
          <button type="button" onClick={() => setOpen(!open)}>{open ? "hide" : "show"}</button>
        </span>
      </div>
      {open && (
        <>
          <div style={styles.grid}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <span style={styles.dim}>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>

          <PaintedLook look={look} onLook={onLook} />

          <div style={styles.section}>simulation (Apply restarts, same seed)</div>
          <div style={styles.grid}>
            {SIM_FIELDS.map((f) => (
              <label key={f.key} style={{ display: "contents" }}>
                <span style={styles.dim}>{f.label}{f.unit ? ` (${f.unit})` : ""}</span>
                {f.choices ? (
                  <select
                    style={styles.input}
                    value={draft.fields[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  >
                    <option value="">default ({f.hint})</option>
                    {f.choices.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input
                    style={styles.input}
                    inputMode="decimal"
                    placeholder={f.hint}
                    value={draft.fields[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )}
              </label>
            ))}
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>other key=value</span>
              <input
                style={styles.input}
                placeholder="e.g. lattice=0.01 model=trt"
                value={draft.other}
                onChange={(e) => setDraft((d) => ({ ...d, other: e.target.value }))}
              />
            </label>
          </div>
          <div style={styles.dim}>options: {options || "(defaults)"}</div>
          <div style={styles.buttons}>
            <button type="button" disabled={options === settings.options} onClick={() => onApply(options)}>
              Apply
            </button>
            <button type="button" onClick={onNewSeed}>New seed</button>
            <button
              type="button"
              onClick={() => {
                setDraft(parseOptions(defaults.options));
                onApply(defaults.options);
                onLook(defaults.look);
              }}
            >
              Reset to config
            </button>
          </div>

          <div style={styles.section}>dots (applies immediately)</div>
          <div style={styles.grid}>
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>radius (units)</span>
              <input
                style={styles.input}
                type="number"
                min="0.25"
                step="0.25"
                value={look.radius}
                onChange={(e) => setLook("radius", Math.max(0.25, Number(e.target.value) || 0.25))}
              />
            </label>
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>dots on</span>
              <input
                type="checkbox"
                checked={look.visible ?? true}
                onChange={(e) => setLook("visible", e.target.checked)}
              />
            </label>
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>opacity</span>
              <input
                style={styles.input}
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={look.opacity ?? 1}
                onChange={(e) => setLook("opacity", Math.min(1, Math.max(0, Number(e.target.value) || 0)))}
              />
            </label>
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>trails (s, 0 = off)</span>
              <input
                style={styles.input}
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={look.trail ?? 0}
                onChange={(e) => setLook("trail", Math.min(5, Math.max(0, Number(e.target.value) || 0)))}
              />
            </label>
            {/* Tracer lines: each dot's recent path, drawn with the dot as one stroke. Its
                length is the dot's speed times the ratio (up to 1 s of history). The dots'
                jitter is off while they show. */}
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>tracer lines</span>
              <input
                type="checkbox"
                checked={look.tracers ?? (look.lines ?? 0) > 0}
                onChange={(e) => onLook({
                  ...look,
                  tracers: e.target.checked,
                  lines: e.target.checked && !((look.lines ?? 0) > 0) ? 0.3 : look.lines,
                })}
              />
            </label>
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>tail length ÷ speed (s)</span>
              <input
                style={styles.input}
                type="number"
                min="0.05"
                max="1"
                step="0.05"
                value={look.lines ?? 0.3}
                onChange={(e) => setLook("lines", Math.min(1, Math.max(0.05, Number(e.target.value) || 0.05)))}
              />
            </label>
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>fade-in (s)</span>
              <input
                style={styles.input}
                type="number"
                min="0"
                step="0.1"
                value={look.fadeIn}
                onChange={(e) => setLook("fadeIn", Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
            <label style={{ display: "contents" }}>
              <span style={styles.dim}>color steps</span>
              <input
                style={styles.input}
                type="number"
                min="1"
                max="16"
                step="1"
                value={look.buckets}
                onChange={(e) =>
                  setLook("buckets", Math.min(16, Math.max(1, Math.round(Number(e.target.value) || 1))))
                }
              />
            </label>
            {/* The shades, darkest first (--color-dot-N in variables.css). */}
            {colors.map((fallback, i) => (
              <label key={i} style={{ display: "contents" }}>
                <span style={styles.dim}>color {i + 1}{i === 0 ? " (darkest)" : ""}</span>
                <input
                  type="color"
                  value={(look.colors ?? colors)[i]}
                  onChange={(e) => {
                    const next = [...(look.colors ?? colors)];
                    next[i] = e.target.value;
                    setLook("colors", next);
                  }}
                />
              </label>
            ))}
          </div>

          <div style={styles.buttons}>
            <button type="button" onClick={copyConfig}>Copy config</button>
            <button type="button" onClick={exportFrame}>Export frame</button>
          </div>
          {copied && (
            <textarea
              readOnly
              rows={4}
              style={{ ...styles.input, font: "11px var(--font-mono)" }}
              value={copied}
              onFocus={(e) => e.target.select()}
            />
          )}
        </>
      )}
    </aside>
  );
}

export default RiverTuner;
