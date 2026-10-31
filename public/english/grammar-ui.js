import {topics,exercises,b1Topics,b1Exercises} from './grammar.js?v=b1';
let tab='theory',index=0,choice=-1;
const isB1=()=>localStorage.getItem('zoalmon-english-level-v1')==='B1'||(!localStorage.getItem('zoalmon-english-level-v1')&&localStorage.getItem('zoalmon-selected-level-en')==='B1');
const activeTopics=()=>isB1()?b1Topics:topics;
const activeExercises=()=>isB1()?b1Exercises:exercises;
export function grammarView(head,esc){
 const level=isB1()?'B1':'A2+',lessons=activeTopics(),items=activeExercises();
 let html=head(`GRAMÁTICA ${level}`,'Entiende el inglés. Úsalo.','Teoría clara en español y práctica con frases completas en contexto.');
 html+=`<div class="grammar-tabs" role="group" aria-label="Secciones de gramática"><button data-grammar-tab="theory" class="${tab==='theory'?'active':''}">Teoría y ejemplos</button><button data-grammar-tab="practice" class="${tab==='practice'?'active':''}">Ejercicios completos</button></div><div id="grammar-panel">`;
 if(tab==='theory'){
  html+=`<div class="theory-grid">${lessons.map(t=>`<article class="theory-card"><h2>${t.title}</h2><p>${t.intro}</p><div class="formula"><b>Estructura</b><br>${t.rule}</div>${t.examples.map(([en,es])=>`<div class="example-line"><span lang="en">${esc(en)}</span><small lang="es">${esc(es)}</small></div>`).join('')}<div class="theory-note">${t.tip}</div></article>`).join('')}</div><p><button class="primary" data-grammar-tab="practice">Practicar con frases completas →</button></p>`;
 }else if(index>=items.length){
  html+=`<div class="panel empty"><h2>¡Terminaste las frases!</h2><p class="sub">Has practicado gramática ${level} en contexto.</p><button class="primary" data-grammar-restart>Repetir ejercicios →</button></div>`;
 }else{
  const [context,sentence,options,answer,complete,translation,why]=items[index];
  html+=`<div class="study"><div class="progress"><span>Frase ${index+1} de ${items.length}</span><span>Completa la idea en inglés</span></div><div class="exercise-progress"><span style="width:${index/items.length*100}%"></span></div><div class="panel"><small class="crumb">LEE EL CONTEXTO</small><p class="sentence-context" lang="es">${esc(context)}</p><h2 class="sentence" lang="en">${esc(sentence)}</h2><div class="exercise-options">${options.map((o,i)=>`<button data-grammar-answer="${i}" ${choice!==-1?'disabled':''}>${esc(o)}</button>`).join('')}</div><div id="grammar-feedback" aria-live="polite"></div>${choice===-1?'':feedback(esc,answer,complete,translation,why)}</div></div>`;
 }
 return html+'</div>';
}
function feedback(esc,answer,complete,translation,why){const correct=choice===answer;return `<div class="feedback"><b>${correct?'¡Muy bien!':'Repasemos la estructura.'}</b><p class="sentence" lang="en">${esc(complete)}</p><p lang="es">${esc(translation)}</p><p>${esc(why)}</p><button class="primary" data-grammar-next>Siguiente frase →</button></div>`}
export function grammarClick(button,record){
 if(button.dataset.grammarTab){tab=button.dataset.grammarTab;if(tab==='practice'){index=0;choice=-1}return true}
 if(button.hasAttribute('data-grammar-restart')){index=0;choice=-1;return true}
 if(button.hasAttribute('data-grammar-next')){index++;choice=-1;return true}
 if(button.dataset.grammarAnswer!==undefined&&choice===-1){choice=Number(button.dataset.grammarAnswer);record('grammar',choice===activeExercises()[index][3]);return true}
 return false;
}
export function grammarAnswer(){return tab==='practice'&&choice!==-1&&index<exercises.length?choice:null}
export function exerciseData(){return activeExercises()}
export function resetGrammar(){tab='theory';index=0;choice=-1}
