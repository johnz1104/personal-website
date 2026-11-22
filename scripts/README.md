# Cold War exhibit calculations

The page uses a static export from simulator revision
`0c898090e6321f6dd8f670ccd7f69e04cbd25c57`. The exporter checks the entire
Python/YAML/JSON source tree against its pinned SHA-256 before calculating.
It does not download or modify the simulator.

From the personal website repository root, with that revision extracted to
`/tmp/red-skies-theory-0c898090e6321f6dd8f670ccd7f69e04cbd25c57`:

```sh
PYTHONPATH=/tmp/red-skies-theory-0c898090e6321f6dd8f670ccd7f69e04cbd25c57/src /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 site-release/scripts/export-cold-war.py /tmp/red-skies-theory-0c898090e6321f6dd8f670ccd7f69e04cbd25c57
node --test site-release/tests/cold-war.test.mjs
npm --prefix site-release run build
npm --prefix site-release run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

The simulator requires numpy, PyYAML, and jsonschema. The export records the
catalog digest, source hashes, event-entry label and seed, starting nuclear
strength, scale, goal weights, contributions, follow-on value, rounded outcome
value and audience cost. Each outcome is checked against both `Valuer` and the
bound game configuration. The intervention halves only Soviet nuclear strength;
it is not an independently reconstructed campaign trajectory.

The teaching game is independent of that export. Its exact evaluator enumerates
expected outcomes analytically; tests independently enumerate all deterministic
unilateral alternatives. Forced resistance never updates a policy or its counts.
Matched runs consume three uniforms each episode even when their paths differ.
The minimum-exploration condition uses the correct gradient of its mixed policy.
No test requires self-play to fail or produce a predetermined learning curve.

Standalone `:::exhibit payoffs`, `:::exhibit crisis`, and `:::exhibit learning`
markers insert the allowlisted lazy components. Raw Markdown HTML remains disabled.
Static fallbacks accompany each module, and renumbered major sections retain old
incoming anchors.

Do not stage, commit, or publish until the author reviews the local preview.
