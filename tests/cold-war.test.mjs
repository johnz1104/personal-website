import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, probabilities, episode, evaluate, diagnostic, freshChallenger, PAYOFFS } from '../src/writeups/exhibits/threat-game.js';
import { renderWriteup, splitExhibits, preserveColdWarAnchors } from '../vite.config.js';
function enumerate([d,r,e]) {
  const endings=[[1-d,PAYOFFS.quiet],[d*(1-r),PAYOFFS.concede],[d*r*(1-e),PAYOFFS.backDown],[d*r*e,PAYOFFS.escalate]];
  return [0,1].map(i=>endings.reduce((sum,[chance,payoff])=>sum+chance*payoff[i],0));
}
test('expected returns and unilateral best responses agree with pure-policy enumeration',()=>{
  for(const logits of [[0,0,0],[2,-4,2],[-5,4,-2],[8,8,8]]) {
    const run={...createRun(),logits}, p=probabilities(run), v=evaluate(run), u=enumerate(p);
    u.forEach((x,i)=>assert.ok(Math.abs(x-v.returns[i])<1e-12));
    const bestA=Math.max(...[0,1].flatMap(d=>[0,1].map(e=>enumerate([d,p[1],e])[0])));
    const bestB=Math.max(...[0,1].map(r=>enumerate([p[0],r,p[2]])[1]));
    [bestA,bestB].forEach((x,i)=>assert.ok(Math.abs(x-u[i]-v.bestResponseGain[i])<1e-12));
    assert.ok(Math.abs(v.conditionalRegret-(-1-v.afterResistance[0]))<1e-12);
  }
});
test('seeded resets reproduce updates and branch counts',()=>{
  const a=createRun(),b=createRun();
  for(let n=0;n<2500;n++){episode(a);episode(b);}
  assert.deepEqual(a,b);
  assert.equal(a.visits[0],2500);
  assert.equal(a.visits[1],2500-a.outcomes.quiet);
  assert.equal(a.visits[2],a.outcomes.backDown+a.outcomes.escalate);
});
test('exploration probabilities remain finite, normalized and bounded over long training',()=>{
  for(const floor of [0,.05]) {
    const run=createRun(99,floor);
    for(let i=0;i<20000;i++)episode(run);
    for(const p of probabilities(run)){assert.ok(Number.isFinite(p));assert.ok(p>=floor&&p<=1-floor);assert.equal(p+(1-p),1);}
    assert.ok(run.baselines.every(Number.isFinite));
  }
});
test('diagnostic is pure; challenger changes only its own policy',()=>{
  const run=createRun();for(let i=0;i<500;i++)episode(run);
  const before=structuredClone(run); diagnostic(run); assert.deepEqual(run,before);
  const challenger=freshChallenger(run),start=structuredClone(challenger);
  for(let i=0;i<1000;i++)episode(challenger,{challengerOnly:true});
  assert.deepEqual(run,before);
  assert.equal(challenger.logits[0],start.logits[0]);assert.equal(challenger.logits[2],start.logits[2]);
  assert.notEqual(challenger.logits[1],start.logits[1]);
});
test('matched conditions consume equal random streams despite different branch paths',()=>{
  const a=createRun(),b=createRun(1962,.05);
  for(let n=0;n<1000;n++){episode(a);episode(b);assert.equal(a.seed,b.seed);}
});
test('exported contributions reproduce every rounded model valuation',()=>{
 const data=JSON.parse(readFileSync(new URL('../src/writeups/exhibits/payoffs.json',import.meta.url)));
 assert.equal(data.rows.length,12);assert.equal(data.commit.length,40);
 for(const r of data.rows){const total=Object.values(r.contributions).reduce((a,b)=>a+b,0)+r.followOn;assert.ok(Math.abs(total-r.value)<=.00500001);assert.ok(r.audienceCost>=0);}
 assert.notDeepEqual(data.rows.filter(r=>r.factor===1).map(r=>r.value),data.rows.filter(r=>r.factor===.5).map(r=>r.value));
});
test('markers are allowlisted and only standalone paragraphs split; raw HTML stays disabled',()=>{
 const html=renderWriteup('## Same\n\n:::exhibit payoffs\n\n## Same\n\n:::exhibit untrusted\n\n<script>alert(1)</script>\n\n```\n:::exhibit learning\n```');
 const parts=splitExhibits(html); assert.equal(parts.filter(p=>p.exhibit).length,1);
 assert.equal(parts[1].exhibit,'payoffs');assert.ok(html.includes('id="same-1"'));assert.ok(!html.includes('<script>'));
});
test('article renders all mathematics and diagrams, and every contents anchor resolves',()=>{
 const source=readFileSync(new URL('../src/writeups/cold-war-simulator.md',import.meta.url),'utf8');
 const html=renderWriteup(source);assert.ok(html.includes('katex'));assert.ok(html.includes('class="mermaid"'));
 assert.deepEqual(splitExhibits(html).filter(p=>p.exhibit).map(p=>p.exhibit),['payoffs','crisis','learning']);
 for(const [,anchor] of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${anchor}"`),anchor);
});

test('renumbered major sections preserve old incoming anchors',()=>{
 const html=preserveColdWarAnchors(renderWriteup('## 5. Reinforcement learning'));
 assert.ok(html.includes('id="6-reinforcement-learning"'));assert.ok(html.includes('id="5-reinforcement-learning"'));
});
