// Fictional perfect-information teaching game. Action 1 means demand/resist/escalate.
export const PAYOFFS = Object.freeze({ quiet: [0, 0], concede: [2, -1], backDown: [-1, 1], escalate: [-4, -4] });
export function createRun(seed = 1962, floor = 0) {
  return { seed: seed >>> 0, floor, logits: [2, -4, 2], baselines: [0, 0, 0], episodes: 0,
    visits: [0, 0, 0], outcomes: { quiet: 0, concede: 0, backDown: 0, escalate: 0 }, last: null };
}
export function random(run) {
  run.seed = (run.seed + 0x6d2b79f5) >>> 0;
  let t = run.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function probabilities(run) {
  return run.logits.map(x => run.floor + (1 - 2 * run.floor) / (1 + Math.exp(-x)));
}
function update(run, node, action, reward, p) {
  const s = 1 / (1 + Math.exp(-run.logits[node]));
  // Exact score gradient for the exploration mixture, rather than pretending
  // a forced action was sampled from an unconstrained sigmoid policy.
  const derivative = (1 - 2 * run.floor) * s * (1 - s);
  const score = action ? derivative / p : -derivative / (1 - p);
  run.logits[node] = Math.max(-14, Math.min(14, run.logits[node] + 0.035 * (reward - run.baselines[node]) * score));
  run.baselines[node] += 0.05 * (reward - run.baselines[node]);
}
export function episode(run, { challengerOnly = false } = {}) {
  const p = probabilities(run);
  // Three uniforms per episode keep the two conditions paired even if paths differ.
  const draws = [random(run), random(run), random(run)];
  const actions = draws.map((x, i) => Number(x < p[i]));
  const nodes = actions[0] ? (actions[1] ? [0, 1, 2] : [0, 1]) : [0];
  const outcome = !actions[0] ? 'quiet' : !actions[1] ? 'concede' : actions[2] ? 'escalate' : 'backDown';
  const reward = PAYOFFS[outcome];
  for (const node of nodes) {
    run.visits[node]++;
    if (!challengerOnly || node === 1) update(run, node, actions[node], reward[node === 1 ? 1 : 0], p[node]);
  }
  run.episodes++;
  run.outcomes[outcome]++;
  run.last = outcome;
  return outcome;
}
export function evaluate(run) {
  const [d, r, e] = probabilities(run);
  const afterResistance = [-1 - 3 * e, 1 - 5 * e];
  const returns = [d * ((1-r)*2 + r*afterResistance[0]), d*((1-r)*-1 + r*afterResistance[1])];
  const best = [Math.max(0, (1-r)*2 - r), d * Math.max(-1, afterResistance[1])];
  return { returns, resistanceReach: d*r, conditionalRegret: 3*e,
    bestResponseGain: best.map((v,i) => Math.max(0,v-returns[i])), afterResistance };
}
export function diagnostic(run, seed = 27) {
  const rng = { seed };
  return random(rng) < probabilities(run)[2] ? 'escalate' : 'backDown';
}
export function freshChallenger(run) {
  const challenger = structuredClone(run);
  challenger.logits[1] = 0;
  challenger.baselines = [0,0,0];
  challenger.seed = 271962;
  challenger.episodes = 0;
  challenger.visits = [0,0,0];
  challenger.outcomes = { quiet: 0, concede: 0, backDown: 0, escalate: 0 };
  challenger.last = null;
  return challenger;
}
