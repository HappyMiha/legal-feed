import type {Source} from '../domain/monitoring';
export const cantonDomains:Record<string,string>={'Zurich':'zh.ch','Bern':'be.ch','Lucerne':'lu.ch','Uri':'ur.ch','Schwyz':'sz.ch','Obwalden':'ow.ch','Nidwalden':'nw.ch','Glarus':'gl.ch','Zug':'zg.ch','Fribourg':'fr.ch','Solothurn':'so.ch','Basel-Stadt':'bs.ch','Basel-Landschaft':'bl.ch','Schaffhausen':'sh.ch','Appenzell Ausserrhoden':'ar.ch','Appenzell Innerrhoden':'ai.ch','St. Gallen':'sg.ch','Graubünden':'gr.ch','Aargau':'ag.ch','Thurgau':'tg.ch','Ticino':'ti.ch','Vaud':'vd.ch','Valais':'vs.ch','Neuchâtel':'ne.ch','Geneva':'ge.ch','Jura':'jura.ch'};
export function cantonSources(canton:string):Source[]{const host=cantonDomains[canton];if(!host)throw Error('Unknown canton.');return ([['courts',`Cantonal courts, including tax courts — ${canton}`,'court'],['legislation',`Cantonal legislation — ${canton}`,'law'],['authorities',`Cantonal authorities — ${canton}`,'authority'],['tax-office',`Cantonal Tax Office ${canton}`,'authority'],['consultations',`Cantonal consultations — ${canton}`,'consultation']] as const).map(([id,name,type])=>({id:`${canton.toLowerCase().replaceAll(' ','-')}-${id}`,name,type,section:'government_cantonal',active:true,canton,url:`https://${canton==='Zurich'&&type==='court'?'gerichte-zh.ch':host}/`}));}
export const sources:Source[]=[
 ...([
 ['federal-court','Federal Supreme Court','court','https://www.bger.ch/'],
 ['administrative-court','Federal Administrative Court','court','https://www.bvger.ch/'],
 ['fedlex','Fedlex','law','https://fedlex.data.admin.ch/api/rss-de.xml'],
 ['estv','Federal Tax Administration (ESTV)','authority','https://www.estv.admin.ch/de/medien-und-news'],
 ['bsv','Federal Social Insurance Office (BSV)','authority','https://www.bsv.admin.ch/de/medienmitteilungen'],
 ['consultations','Swiss consultations (Vernehmlassungen)','consultation','https://www.fedlex.admin.ch/de/consultation-procedures']
 ] as const).map(([id,name,type,url])=>({id,name,type,url,section:'government_federal' as const,active:true})),
 ...cantonSources('Zurich'),
 ...([
 ['SECA','https://www.seca.ch/en/knowledge-library/news/'],
 ['Swiss Startup Association','https://swissstartupassociation.ch/feed/'],
 ['EXPERTsuisse','https://www.expertsuisse.ch/'],
 ['economiesuisse','https://www.economiesuisse.ch/de/aktuell'],
 ] as const).map(([name,url])=>({id:name.toLowerCase().replaceAll(' ','-'),name,url,type:'association' as const,section:'non_government' as const,active:true}))
];
export function canonicalSource(source:Source){if(source.section==='signal')return {...source,requested:false};const expected=(source.canton?cantonSources(source.canton):sources).find(s=>s.id===source.id);if(!expected)throw Error('Unknown source.');return {...expected,active:source.active};}
