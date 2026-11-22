import { Component, lazy, Suspense } from 'react';
import data from './payoffs.json';
import './exhibits.css';
const exhibits={payoffs:lazy(()=>import('./Payoffs.jsx')),crisis:lazy(()=>import('./Crisis.jsx')),learning:lazy(()=>import('./Learning.jsx'))};
function StaticExhibit({id}) {
 if(id==='payoffs')return <section className="exhibit"><h3>How the inherited world changes the stakes</h3><p>Offline model calculation: reconstructed Cuban crisis entry, compared with halved Soviet nuclear strength. US outcome values before risk and action costs:</p><table><thead><tr><th>Outcome</th><th>Entry</th><th>Half strength</th></tr></thead><tbody>{['a_prevails','compromise','b_prevails'].map(outcome=><tr key={outcome}><th>{{a_prevails:'Soviet withdrawal',compromise:'Compromise',b_prevails:'Missiles remain'}[outcome]}</th>{[1,.5].map(factor=><td key={factor}>{data.rows.find(r=>r.power==='USA'&&r.outcome===outcome&&r.factor===factor).value.toFixed(2)}</td>)}</tr>)}</tbody></table><p>Source: simulator revision {data.commit.slice(0,7)}, historical entry seed 0.</p></section>;
 if(id==='crisis')return <section className="exhibit"><h3>Information and delegation</h3><ol><li>World conditions determine whether the Cuban crisis opens.</li><li>Private resolve and readiness are not fully revealed by intelligence.</li><li>Washington chooses quarantine, an air strike, or acceptance.</li><li>Delegation and signals shape a separate officer’s decision.</li><li>The reconstructed negotiation changes the world inherited by later events.</li></ol></section>;
 return <section className="exhibit"><h3>Does the threat survive being tested?</h3><p>In the fictional game, the demander receives 2 after concession, −1 after backing down, and −4 after escalation. The opponent receives −1, 1, and −4 respectively. No demand gives both zero.</p><p>If the opponent seldom resists, self-play may rarely update the demander’s response to resistance. Conditional regret tests that response separately from the return earned on the usual path. The interactive experiment runs genuine seeded policy-gradient updates.</p></section>;
}
class ExhibitBoundary extends Component {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<><p role="status">Interactive controls could not load. The static explanation remains available.</p>{this.props.fallback}</>:this.props.children;}
}
export default function Exhibit({id}) {
 const Interactive=exhibits[id];
 if(!Interactive)return null;
 const fallback=<StaticExhibit id={id}/>;
 return <ExhibitBoundary fallback={fallback}><Suspense fallback={fallback}><Interactive/></Suspense></ExhibitBoundary>;
}
