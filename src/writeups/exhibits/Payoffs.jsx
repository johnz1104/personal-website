import { useState } from 'react';
import data from './payoffs.json';
const labels={a_prevails:'Soviet withdrawal without concessions',compromise:'Negotiated compromise',b_prevails:'Missiles remain in Cuba'};
const fmt=x=>x.toFixed(3);
export default function Payoffs(){
  const [power,setPower]=useState('USA'),[outcome,setOutcome]=useState('compromise'),[commitment,setCommitment]=useState(false);
  const rows=data.rows.filter(r=>r.power===power&&r.outcome===outcome);
  const keys=Object.keys(rows[0].contributions);
  const chartKeys=[...keys,'follow-on'];
  const contribution=(r,key)=>key==='follow-on'?r.followOn:r.contributions[key];
  const scale=Math.max(.1,...rows.flatMap(r=>chartKeys.map(key=>Math.abs(contribution(r,key)))));
  return <section className="exhibit" aria-labelledby="payoff-title"><p className="exhibit-kicker">Calculated from the production model</p><h3 id="payoff-title">How the inherited world changes the stakes</h3>
    <p>Compare the reconstructed Cuban crisis entry with a copy in which Soviet nuclear strength is halved. All other entry fields and the event definition stay fixed. This is a direct change to the entry state, not a simulated earlier decision.</p>
    <div className="exhibit-controls"><label>Whose goals? <select value={power} onChange={e=>setPower(e.target.value)}><option value="USA">United States</option><option value="USSR">Soviet Union</option></select></label><label>Outcome <select value={outcome} onChange={e=>setOutcome(e.target.value)}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label><input type="checkbox" checked={commitment} onChange={e=>setCommitment(e.target.checked)}/> Include backing-down cost</label><button onClick={()=>{setPower('USA');setOutcome('compromise');setCommitment(false);}}>Reset</button></div>
    <p>World conditions → outcome effects → changes in goals → weighted value. Relative strength changes security values, including the value of later events. For the US compromise shown initially, the value comes entirely from those follow-on effects; the immediate goal contributions are zero.</p>
    <div className="exhibit-grid">{rows.map(r=><div key={r.factor}><h4>{r.factor===1?'Reconstructed entry':'Half Soviet nuclear strength'}</h4><p>Soviet nuclear strength: {fmt(data.originalNuclear*r.factor)}</p>
      <svg width="100%" height="240" role="img" aria-label="Weighted goal contributions; exact values in the table below"><line x1="60%" x2="60%" y1="0" y2="240" stroke="currentColor"/>{chartKeys.map((key,i)=>{const v=contribution(r,key),w=Math.abs(v)/scale*33;return <g key={key}><text x="0" y={i*29+19}>{key}</text><rect x={`${v<0?60-w:60}%`} y={i*29+5} width={`${w}%`} height="18" fill="currentColor"/></g>;})}</svg>
      <p>Derived outcome value: <strong>{r.value.toFixed(2)}</strong>{commitment&&<>; backing-down cost: <strong>−{r.audienceCost.toFixed(2)}</strong>; combined before risk/other action costs: <strong>{(r.value-r.audienceCost).toFixed(2)}</strong></>}</p></div>)}</div>
    <div className="writeup-table"><table><caption>Weighted contributions in payoff units</caption><thead><tr><th>Component</th><th>Reconstructed entry</th><th>Half strength</th></tr></thead><tbody>{keys.map(key=><tr key={key}><th>{key}</th>{rows.map(r=><td key={r.factor}>{fmt(r.contributions[key])}</td>)}</tr>)}<tr><th>Follow-on value</th>{rows.map(r=><td key={r.factor}>{fmt(r.followOn)}</td>)}</tr><tr><th>Rounded outcome value</th>{rows.map(r=><td key={r.factor}>{r.value.toFixed(2)}</td>)}</tr></tbody></table></div>
    <p>The checkbox isolates the cost of backing down after a public commitment: a 0.1 reduction in modeled credibility, converted using this power’s goals. It does not claim that every selected outcome incurs that cost. The game also accounts for applicable action costs and risk attitudes before comparing decisions.</p>
    <details><summary>Calculation sources</summary><p>Historical replay entry, seed 0, {data.entry}; payoff scale κ = {data.kappa}. Values are exported offline and checked against the bound game configuration. They are model calculations, not measured historical preferences.</p><p><a href={`${data.source}/tree/${data.commit}`}>Simulator revision {data.commit.slice(0,7)}</a> · <a href={`${data.source}/blob/${data.commit}/src/cold_war_sim/campaign/payoffs/derive.py`}>Valuation code</a> · <a href={`${data.source}/blob/${data.commit}/src/cold_war_sim/campaign/data/events/era3_1954_1962.yaml`}>Crisis configuration</a></p></details>
  </section>;
}
