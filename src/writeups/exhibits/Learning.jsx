import { useEffect, useRef, useState } from 'react';
import { createRun, probabilities, episode, evaluate, diagnostic, freshChallenger, PAYOFFS } from './threat-game.js';
const names = { quiet: 'No demand', concede: 'Concede', backDown: 'Back down', escalate: 'Escalate' };
const pct = x => `${(100*x).toFixed(1)}%`;
const num = x => x.toFixed(3);
function Stats({ run, title }) {
  const p = probabilities(run), v = evaluate(run);
  return <div className="exhibit-condition"><h4>{title}</h4><p>{run.episodes.toLocaleString()} training episodes</p>
    <table className="learning-policy-table"><colgroup><col style={{width:"48%"}}/><col style={{width:"30%"}}/><col style={{width:"22%"}}/></colgroup><thead><tr><th>Decision</th><th>Chance</th><th>Visits</th></tr></thead><tbody>
      {['Demand', 'Resist given demand', 'Escalate given resistance'].map((label,i)=><tr key={label}><th>{label}</th><td>{pct(p[i])}</td><td>{run.visits[i]}</td></tr>)}
    </tbody></table>
    <dl><dt>Expected return (demander / opponent)</dt><dd>{v.returns.map(num).join(' / ')}</dd>
    <dt>Resistance branch: expected / observed</dt><dd>{pct(v.resistanceReach)} / {run.episodes ? pct(run.visits[2]/run.episodes) : 'no episodes'}</dd>
    <dt>Demander’s conditional regret after resistance</dt><dd>{num(v.conditionalRegret)}</dd>
    <dt>Exact best-response gain (demander / opponent)</dt><dd>{v.bestResponseGain.map(num).join(' / ')}</dd></dl>
    <svg width="100%" height="80" role="img" aria-label={`Chance of resistance ${pct(v.resistanceReach)}; escalation after resistance ${pct(p[2])}`}>
      <text x="0" y="15">Reach resistance</text><rect x="0" y="22" width={`${100*v.resistanceReach}%`} height="10" fill="currentColor"/>
      <text x="0" y="51">Escalate if resisted</text><rect x="0" y="58" width={`${100*p[2]}%`} height="10" fill="currentColor"/>
    </svg><p>Latest episode: {names[run.last] || 'none yet'}.</p></div>;
}
export default function Learning() {
  const [runs,setRuns] = useState(()=>[createRun(),createRun(1962,0.05)]);
  const [busy,setBusy] = useState(false), [frozen,setFrozen] = useState(false);
  const [trial,setTrial] = useState(''), [challenger,setChallenger] = useState(null);
  const generation = useRef(0);
  useEffect(()=>()=>{generation.current++;},[]);
  const reset=()=>{generation.current++;setBusy(false);setFrozen(false);setTrial('');setChallenger(null);setRuns([createRun(),createRun(1962,0.05)]);};
  async function train(count, challenge=false) {
    const token=++generation.current;
    setBusy(true);
    let current=challenge ? structuredClone(challenger || freshChallenger(runs[0])) : structuredClone(runs);
    for(let done=0;done<count;done+=25) {
      if(token!==generation.current)return;
      for(let n=0;n<Math.min(25,count-done);n++) {
        if(challenge)episode(current,{challengerOnly:true});else current.forEach(r=>episode(r));
      }
      if(challenge)setChallenger(structuredClone(current));else setRuns(structuredClone(current));
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(token===generation.current)setBusy(false);
  }
  const baseline=evaluate(runs[0]);
  return <section className="exhibit" aria-labelledby="learning-title"><p className="exhibit-kicker">Fictional learning experiment</p>
    <h3 id="learning-title">Does the threat survive being tested?</h3>
    <p>A demander can leave things alone or make a threat. The opponent can concede or resist. After resistance, the demander chooses whether to escalate or back down.</p>
    <table><caption>Terminal payoffs, in illustrative units</caption><thead><tr><th>Ending</th><th>Demander</th><th>Opponent</th></tr></thead><tbody>{Object.entries(PAYOFFS).map(([key,values])=><tr key={key}><th>{names[key]}</th>{values.map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody></table>
    <p>The ordinary run starts with an 88.1% probability of demand and of escalation; resistance has a 1.8% probability. This deliberately makes the threat rarely tested. Both runs use seed 1962, learning rate 0.035, terminal rewards and running baselines (rate 0.05), with no discounting. The comparison gives each action at least 5% probability.</p>
    <div className="exhibit-controls"><button disabled={busy||frozen} onClick={()=>train(1)}>One episode</button><button disabled={busy||frozen} onClick={()=>train(500)}>Train 500 episodes</button><button disabled={busy||frozen} onClick={()=>setFrozen(true)}>Freeze policies</button><button onClick={reset}>Reset</button></div>
    <p role="status">{busy?'Training…':frozen?'Policies frozen. Test the ordinary run below.':'Ready. Both conditions train together with matched random draws.'}</p>
    <div className="exhibit-grid">{runs.map((run,i)=><Stats key={i} run={run} title={i?'Minimum exploration':'Ordinary self-play'}/>)}</div>
    <p>Conditional regret asks how much the demander could gain by choosing better <em>after resistance</em>. Here, backing down gives −1 and escalation gives −4, so regret is three times the escalation probability. Exact best-response gains allow either player to replace its entire policy against its fixed opponent, without the exploration constraint.</p>
    <div className="exhibit-controls"><button disabled={!frozen||busy} onClick={()=>setTrial(names[diagnostic(runs[0])])}>Force resistance (diagnostic)</button><button disabled={!frozen||busy} onClick={()=>train(500,true)}>Train challenger for 500 episodes</button></div>
    <p role="status">{trial?`Diagnostic response: ${trial}. The demand and resistance were forced; no policy or training count changed. Diagnostic seed: 27.`:'Freeze first to test a forced resistance or a fresh challenger.'}</p>
    {challenger && <><p>Fresh opponent starts at 50% resistance. Only it learns; the ordinary demander stays fixed. Challenger gain over the frozen opponent: <strong>{num(evaluate(challenger).returns[1]-baseline.returns[1])}</strong>. Its exact available gain at the start was {num(baseline.bestResponseGain[1])}.</p><Stats run={challenger} title="Challenger against frozen demander"/></>}
    <p>A high escalation probability can coexist with few visits to that branch. Watch whether training changes both. A challenger may find no gain when resistance still meets a credible threat; that does not settle whether escalation is optimal once resistance occurs.</p>
  </section>;
}
