import {ArrowRight,CheckCircle2,FileText,LockKeyhole,Mail,Search,Users} from 'lucide-react';
import {BrandLockup} from '../components/brand';
import {Button} from '../components/controls';

const steps=[
 {title:'Create a profile',text:'Describe the legal topics or client you want to follow.',Icon:FileText},
 {title:'Choose sources',text:'Select Swiss courts, authorities and other publications.',Icon:Search},
 {title:'Read your feed',text:'Get relevant updates, AI summaries and links to the original publications.',Icon:CheckCircle2},
 {title:'Set email alerts',text:'Choose instant alerts, a weekly digest, or both.',Icon:Mail},
];
export default function Landing(){
 return <main className="landing">
  <aside className="landing-statement">
   <a href="/" aria-label="Legal Feed home"><BrandLockup inverse/></a>
   <div className="landing-problem"><h2>Legal updates never stop.<br/><span>Finding what matters is still manual.</span></h2><div className="landing-rule"/><p>Lawyers still spend time manually tracking, interpreting and assessing updates across multiple sources.</p></div>
   <svg className="landing-waves" viewBox="0 0 500 180" fill="none" aria-hidden="true">{Array.from({length:9},(_,i)=><path key={i} d={`M-30 ${65+i*12} C150 ${-45+i*13} 250 ${240-i*6} 530 ${15+i*12}`} stroke="currentColor"/>)}</svg>
  </aside>
  <section className="landing-main" aria-labelledby="landing-title">
   <div className="landing-intro"><p className="landing-kicker">LEGAL FEED · SWISS LEGAL MONITORING</p><h1 id="landing-title">Your personal feed of Swiss legal updates.</h1><p className="landing-description">Create a Legal Feed account to follow the legal topics that matter to your work. Get relevant laws, court decisions and official publications in your own feed and by email.</p>
    <nav className="landing-actions" aria-label="Get started with Legal Feed"><Button size="lg" asChild><a href="/register">Create Legal Feed account<ArrowRight/></a></Button><Button size="lg" variant="outline" asChild><a href="/login">Sign in</a></Button></nav>
    <p className="landing-signup-note">Register with your email, then set up your first monitoring profile.</p>
   </div>
   <section className="landing-onboarding" aria-labelledby="landing-next"><h2 id="landing-next">What happens after you register</h2><ol className="landing-steps">{steps.map(({title,text,Icon},index)=><li key={title}><span className="landing-step-number">{index+1}</span><Icon className="landing-step-icon" aria-hidden="true"/><h3>{title}</h3><p>{text}</p>{index<3&&<ArrowRight className="landing-step-arrow" aria-hidden="true"/>}</li>)}</ol></section>
   <div className="landing-provider"><span className="landing-icon"><LockKeyhole aria-hidden="true"/></span><p>Powered by <strong>Apertus LLM.</strong><span> AI processing by Swisscom.</span></p></div>
   <footer className="landing-credit"><span className="landing-icon"><Users aria-hidden="true"/></span><div><p>Built on the winning Helvetic Lens solution by <strong>Team Drusi</strong> at the Swiss AI Weeks 2026 Legal Hackathon.</p><p className="landing-names">Timothy Rabozzi · Michael Shavritzkiy · Max Sidanich</p></div></footer>
  </section>
 </main>;
}
