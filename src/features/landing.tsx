import {ArrowRight,ChartNoAxesColumnIncreasing,CheckCircle2,FileText,LockKeyhole,Search,Users} from 'lucide-react';
import {BrandLockup} from '../components/brand';
import {Button} from '../components/controls';

const steps=[
 {title:'Watch',text:'Monitor trusted sources',Icon:FileText},
 {title:'Detect',text:'Identify meaningful changes',Icon:Search},
 {title:'Interpret',text:'Assess legal relevance and impact',Icon:ChartNoAxesColumnIncreasing},
 {title:'Act',text:'Review what needs your attention',Icon:CheckCircle2},
];
export default function Landing(){
 return <main className="landing">
  <aside className="landing-statement">
   <a href="/" aria-label="Legal Feed home"><BrandLockup inverse/></a>
   <div className="landing-problem"><h2>Legal updates never stop.<br/><span>Finding what matters is still manual.</span></h2><div className="landing-rule"/><p>Lawyers still spend time manually tracking, interpreting and assessing updates across multiple sources.</p></div>
   <svg className="landing-waves" viewBox="0 0 500 180" fill="none" aria-hidden="true">{Array.from({length:9},(_,i)=><path key={i} d={`M-30 ${65+i*12} C150 ${-45+i*13} 250 ${240-i*6} 530 ${15+i*12}`} stroke="currentColor"/>)}</svg>
  </aside>
  <section className="landing-main" aria-labelledby="landing-title">
   <div className="landing-intro"><p className="landing-kicker">From the creators of Helvetic Lens</p><h1 id="landing-title">LEGAL FEED</h1><h2>AI-powered legal change monitoring — from source to action.</h2><p className="landing-description">Continuously monitors trusted sources, detects relevant changes, assesses their legal relevance and tells legal teams what requires attention.</p>
    <nav className="landing-actions" aria-label="Get started"><Button size="lg" asChild><a href="/register">Create account<ArrowRight/></a></Button><Button size="lg" variant="outline" asChild><a href="/login">Sign in</a></Button></nav>
   </div>
   <div className="landing-provider"><span className="landing-icon"><LockKeyhole aria-hidden="true"/></span><p>Powered by <strong>Apertus LLM.</strong><span> AI processing by Swisscom.</span></p></div>
   <ol className="landing-steps">{steps.map(({title,text,Icon},index)=><li key={title}><span className="landing-step-number">{index+1}</span><Icon className="landing-step-icon" aria-hidden="true"/><h3>{title}</h3><p>{text}</p>{index<3&&<ArrowRight className="landing-step-arrow" aria-hidden="true"/>}</li>)}</ol>
   <footer className="landing-credit"><span className="landing-icon"><Users aria-hidden="true"/></span><div><p>Built on the winning Helvetic Lens solution by <strong>Team Drusi</strong> at the Swiss AI Weeks 2026 Legal Hackathon.</p><p className="landing-names">Timothy Rabozzi · Michael Shavritzkiy · Max Sidanich</p></div></footer>
  </section>
 </main>;
}
