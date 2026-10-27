import {bank,levels} from './bank.js';
export const skills=['grammar','vocabulary','reading'];
const grid=Array.from({length:29},(_,i)=>-.5+i*.25);
export const norm=s=>String(s).normalize('NFC').trim().toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ');
function posterior(session,skill){
 let weights=grid.map(x=>Math.exp(-.5*((x-session.initial)/1.8)**2));
 for(const a of session.responses.filter(a=>a.skill===skill)){
  const q=bank.find(q=>q.id===a.id),guess=q.options?1/q.options.length:0;
  weights=weights.map((w,i)=>{const p=guess+(1-guess)/(1+Math.exp(-1.6*(grid[i]-q.difficulty)));return w*(a.correct?p:1-p)});
  const total=weights.reduce((a,b)=>a+b,0);weights=weights.map(w=>w/total);
 }
 const total=weights.reduce((a,b)=>a+b,0);weights=weights.map(w=>w/total);
 const mean=weights.reduce((a,w,i)=>a+w*grid[i],0),sd=Math.sqrt(weights.reduce((a,w,i)=>a+w*(grid[i]-mean)**2,0));
 return {mean,sd,count:session.responses.filter(a=>a.skill===skill).length,level:levels[Math.max(0,Math.min(5,Math.round(mean)))]};
}
export function estimate(s){
 const bySkill=Object.fromEntries(skills.map(k=>[k,posterior(s,k)]));
 const mean=skills.reduce((a,k)=>a+bySkill[k].mean,0)/3;
 const sd=Math.max(.4,Math.sqrt(skills.reduce((a,k)=>a+bySkill[k].sd**2,0))/3);
 const band=x=>levels[Math.max(0,Math.min(5,Math.round(x)))];
 return {bySkill,mean,sd,level:band(mean),range:[band(mean-1.64*sd),band(mean+1.64*sd)]};
}
export function shouldStop(s){
 const n=s.responses.length,e=estimate(s);
 const stable=s.anchors.length>=3&&Math.max(...s.anchors.slice(-3))-Math.min(...s.anchors.slice(-3))<.35;
 return n>=40||(n>=18&&skills.every(k=>e.bySkill[k].count>=4)&&stable&&e.sd<=.43);
}
export function selectQuestion(s,rng=Math.random){
 if(shouldStop(s))return null;
 const used=new Set(s.responses.map(a=>a.id));
 const counts=skills.map(k=>[k,s.responses.filter(a=>a.skill===k).length]).sort((a,b)=>a[1]-b[1]);
 let candidates=bank.filter(q=>q.language===s.language&&!used.has(q.id)&&q.skill===counts[0][0]);
 if(!candidates.length)candidates=bank.filter(q=>q.language===s.language&&!used.has(q.id));
 if(!candidates.length)return null;
 const target=s.anchor+(rng()-.5)*.5;
 candidates.sort((a,b)=>Math.abs(a.difficulty-target)-Math.abs(b.difficulty-target)||((s.previousIds||[]).includes(a.id)?1:0)-((s.previousIds||[]).includes(b.id)?1:0));
 const q=candidates[0],order=q.options?q.options.map((_,i)=>i):null;
 if(order)for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
 return {id:q.id,order};
}
export function newSession(id,language,expected,previousIds=[]){
 if(!['en','fr'].includes(language)||expected!==undefined&&!levels.includes(expected))throw Error('Idioma o nivel inválido.');
 const initial=expected?levels.indexOf(expected):1.5;
 const s={id,language,initial,anchor:initial,anchors:[],responses:[],previousIds:previousIds.filter(id=>typeof id==='string'),createdAt:new Date().toISOString()};
 s.pending=selectQuestion(s);return s;
}
export function submit(s,id,value,elapsed){
 if(s.completedAt||!s.pending||id!==s.pending.id)throw Error('Pregunta desactualizada. Recarga para retomar.');
 const q=bank.find(q=>q.id===id);
 if(q.options?(!Number.isInteger(value)||value<0||value>=s.pending.order.length):(typeof value!=='string'||!value.trim()||value.length>300))throw Error('Respuesta inválida o incompleta.');
 const correct=q.options?s.pending.order[value]===q.answer:norm(value)===norm(q.answer);
 s.responses.push({id,skill:q.skill,difficulty:q.difficulty,value,correct,elapsed:Number.isFinite(elapsed)?Math.min(3600000,Math.max(0,elapsed)):null,at:new Date().toISOString()});
 // Re-anchor only after three answers, never from one answer alone.
 if(s.responses.length%3===0){s.anchor=estimate(s).mean;s.anchors.push(s.anchor)}
 s.pending=selectQuestion(s);
 if(!s.pending){s.completedAt=new Date().toISOString();s.result=result(s)}
 return s;
}
export function result(s){
 const e=estimate(s),rank=skills.slice().sort((a,b)=>e.bySkill[b].mean-e.bySkill[a].mean);
 const reading=bank.find(q=>q.language===s.language&&q.skill==='reading'&&q.level===e.level);
 return {...e,practice:{passage:reading.passage,task:e.mean<2?'Identifica quién hace qué y escribe dos frases sobre el texto.':e.mean<4?'Resume el argumento y explica una consecuencia con tus palabras.':'Analiza las reservas y presupuestos del argumento; escribe una objeción y una respuesta. No se corrige automáticamente.'},completedAt:s.completedAt,language:s.language,count:s.responses.length,provisional:s.responses.length>=40||e.sd>.43,confidence:e.sd<=.43?'moderada':'baja',strongest:rank[0],weakest:rank.at(-1),excluded:['listening','writing','speaking'],reason:'Estimación heurística según la dificultad de los ítems y evidencia por habilidad; no es un porcentaje de aciertos ni una certificación CEFR.'};
}
export function publicSession(s){
 const q=s.pending?bank.find(q=>q.id===s.pending.id):null;
 return {answeredIds:s.responses.map(x=>x.id),id:s.id,language:s.language,count:s.responses.length,completedAt:s.completedAt,result:s.result,
 question:q?{id:q.id,type:q.type,skill:q.skill,prompt:q.prompt,passage:q.passage,options:s.pending.order?.map(i=>q.options[i])}:null};
}
