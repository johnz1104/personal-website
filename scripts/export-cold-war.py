"""Run with pinned Python 3.11; argument is the simulator checkout at PIN.
PYTHONPATH=<checkout>/src python export-cold-war.py <checkout>
No network requests; output is a reproducible calculation, not a research result.
"""
import copy
import hashlib
import json
from pathlib import Path
import sys
from cold_war_sim.campaign.catalog.core import load_catalog
from cold_war_sim.campaign.environments.scenario import capture_entries
from cold_war_sim.campaign.payoffs import goals
from cold_war_sim.campaign.payoffs.derive import Valuer

PIN = '0c898090e6321f6dd8f670ccd7f69e04cbd25c57'
root = Path(sys.argv[1]).resolve()
# Verify the imported code and complete source/data tree, including archive checkouts.
import inspect
assert Path(inspect.getfile(Valuer)).resolve() == root/'src/cold_war_sim/campaign/payoffs/derive.py'
source_hash = hashlib.sha256()
for source_file in sorted((root/'src').rglob('*')):
    if source_file.is_file() and source_file.suffix in ('.py', '.yaml', '.json'):
        source_hash.update(str(source_file.relative_to(root)).encode()+b'\0'+source_file.read_bytes())
assert source_hash.hexdigest() == 'e54f2b8d06bef097541d2992e678e082337cc0fd2445f49a27824507afdb095c', 'Source differs from pinned revision'

paths = ['campaign/payoffs/derive.py', 'campaign/payoffs/goals.py', 'campaign/data/goals.yaml', 'campaign/data/events/era3_1954_1962.yaml']
c = load_catalog()
e = c.events['cuban_missile_crisis']
entry = capture_entries(c, [e.id])[e.id][0]
rows = []
for factor in [1, 0.5]:
    w = copy.deepcopy(entry.state.world)
    w.powers['USSR'].nuclear *= factor
    v = Valuer(c, e, w, c.goals)
    for power in ['USA', 'USSR']:
        weights = goals.row(w, power, c, c.goals).weights
        before = goals.components(w, power, c, c.goals)
        for label in ['a_prevails', 'compromise', 'b_prevails']:
            after = v.after([e.major.outcomes[label].effects], label=label)
            end = goals.components(after, power, c, c.goals)
            contributions = {k: v.kappa * weights.get(k, 0) * (end[k] - before[k]) for k in goals.COMPONENTS}
            follow = v.kappa * v.follow_on(after, power, weights, end)
            value = v.label_value(label, power)
            assert abs(round(sum(contributions.values()) + follow, 2) - value) < 1e-8
            bound = c.instantiate_config(e.id, w)
            assert bound['roles'][power]['values'][label] == value
            cost = bound['roles'][power]['audience_cost']
            rows.append(dict(factor=factor, power=power, outcome=label, contributions=contributions, followOn=follow, value=value, audienceCost=cost, weights=dict(weights)))
payload = dict(commit=PIN, source='https://github.com/johnz1104/red-skies-theory', entry=entry.label, catalog=c.digest,
    seed=0, sourceTreeSHA256=source_hash.hexdigest(), kappa=c.goals.kappa, sourceHashes={p: hashlib.sha256((root/'src/cold_war_sim'/p).read_bytes()).hexdigest() for p in paths},
    originalNuclear=entry.state.world.powers['USSR'].nuclear, rows=rows)
output = Path(__file__).resolve().parents[1]/'src/writeups/exhibits/payoffs.json'
output.write_text(json.dumps(payload, indent=2)+'\n')
print('Verified and exported', len(rows), 'outcome valuations to', output)
