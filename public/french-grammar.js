import {frenchLessons} from './french-grammar-data.js';
const KEY='zoalmon-fr-a1-grammar';
let index=0,answers={};
try {
  const saved=JSON.parse(localStorage.getItem(KEY));
  if(Number.isInteger(saved?.index)&&saved.index>=0&&saved.index<frenchLessons.length)index=saved.index;
  if(saved?.answers&&typeof saved.answers==='object')for(const [id,n] of Object.entries(saved.answers)){
    const l=frenchLessons.find(x=>x.id===id);
    if(l&&Number.isInteger(n)&&n>=0&&n<l.exercise[1].length)answers[id]=n;
  }
}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify({index,answers}))}catch{}}
export function frenchGrammarView(esc){
 const l=frenchLessons[index],choice=answers[l.id],[prompt,options,answer,complete,translation,why]=l.exercise,answered=Number.isInteger(choice);
 return `<section class="fr-grammar" lang="es"><p class="eyebrow">FRANCÉS DESDE CERO · A1</p><h1>Tu primera gramática francesa.</h1><p class="fr-intro">Aprende las bases en orden, con explicaciones en español, ejemplos y una frase para practicar cada lección.</p><div class="fr-selector"><label for="fr-lesson">Elige una lección</label><select id="fr-lesson">${frenchLessons.map((x,i)=>`<option value="${i}" ${i===index?'selected':''}>${i+1}. ${esc(x.title)}</option>`).join('')}</select></div><div class="fr-progress"><span>Lección ${index+1} de ${frenchLessons.length}</span><span>${Object.keys(answers).length} practicadas</span></div><article class="panel fr-theory"><h2>${esc(l.title)}</h2><p>${esc(l.intro)}</p><div class="fr-rule"><h3>Estructura y formas</h3><p lang="fr">${esc(l.rule)}</p></div><h3>Ejemplos en contexto</h3>${l.examples.map(([fr,es])=>`<div class="fr-example"><p lang="fr">${esc(fr)}</p><p>${esc(es)}</p></div>`).join('')}<p class="fr-tip"><strong>Recuerda:</strong> ${esc(l.tip)}</p></article><section class="panel fr-practice" aria-label="Ejercicio de la lección"><h2>Ahora te toca.</h2><p>${esc(prompt)}</p><div class="fr-choices">${options.map((o,i)=>`<button data-fr-answer="${i}" ${answered?'disabled':''} class="${answered?(i===answer?'fr-correct':i===choice?'fr-wrong':''):''}" lang="fr">${esc(o)}</button>`).join('')}</div>${answered?`<div class="fr-feedback" role="status"><h3>${choice===answer?'¡Muy bien!':'Vamos a repasarlo.'}</h3><p lang="fr">${esc(complete)}</p><p>${esc(translation)}</p><p>${esc(why)}</p><button class="secondary" data-action="listen" data-text="${esc(complete)}">Escuchar la frase</button> <button class="secondary" data-fr-retry>Intentar de nuevo</button></div>`:''}</section><div class="fr-navigation"><button class="secondary" data-fr-step="-1" ${index===0?'disabled':''}>Lección anterior</button><button class="primary" data-fr-step="1" ${index===frenchLessons.length-1?'disabled':''}>Siguiente lección</button></div><p class="fr-end">Puedes volver a cualquier lección cuando necesites repasar.</p></section>`;
}
export function frenchGrammarClick(button,record){
 if(button.dataset.frAnswer!==undefined){
  const l=frenchLessons[index],n=Number(button.dataset.frAnswer);
  if(!Number.isInteger(answers[l.id])&&Number.isInteger(n)&&n>=0&&n<l.exercise[1].length){answers[l.id]=n;record('exercise',n===l.exercise[2]);save()}
  return 'answer';
 }
 if(button.dataset.frStep!==undefined){
  index=Math.max(0,Math.min(frenchLessons.length-1,index+Number(button.dataset.frStep)));save();return 'lesson';
 }
 if(button.hasAttribute('data-fr-retry')){delete answers[frenchLessons[index].id];save();return 'answer'}
 return false;
}
export function frenchGrammarChange(target){
 if(target.id!=='fr-lesson')return false;
 const n=Number(target.value);if(Number.isInteger(n)&&n>=0&&n<frenchLessons.length){index=n;save();return true}
 return false;
}
