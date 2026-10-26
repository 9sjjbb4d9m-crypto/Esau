export function layout(w,h){
 const phone=w<700,mx=phone?16:w*.055,my=phone?16:h*.085,bw=w-mx*2,bh=h-my*2,s=bw/1730;
 const nh=phone?60:bh*.108,gap=14,ph=bh-nh-gap;
 const font=phone?Math.min(bw*.115,ph*.095):Math.min(bw*.078,ph*.2);
 const eye=phone?ph*.10:ph*.135,hy=eye+(phone?38:48*s);
 return {w,h,phone,mx,my,bw,bh,s,nh,gap,ph,py:-(nh+gap)/2,ny:bh/2-nh/2,
  tx:bw*(phone?.075:.055),eye,hy,font,subY:hy+font*1.94+(phone?24:30*s),
  subFont:phone?13:18*s,small:phone?10:11*s,pillW:phone?142:154*s,pillH:phone?44:40*s};
}
export function content(course){
 const en=course==='en';
 return {brand:en?'zoalmon gringo':'zoalmon',lines:en?['Dale forma','a tu inglés.']:['Tu francés,','otra dimensión.'],
  eyebrow:en?'INGLÉS · ESPAÑOL · A2+':'FRANCÉS · DESDE CERO · A1',
  sub:en?['Palabras, ideas y conversaciones que abren puertas.','Aprende a tu ritmo. Hazlo parte de tu día.']:['De tus primeras palabras a tus primeras conversaciones.','Comprende, practica y encuentra tu voz.'],
  primary:'Empezar',paper:'Cómo funciona →',meta:en?'Evaluar mi inglés':'Evaluar mi francés',
  terms:[['Repetición espaciada','Vuelve a cada palabra cuando toca recordarla. Tus respuestas ajustan el siguiente repaso.'],
   ['Contexto','Aprende con ejemplos y frases completas para conectar lo que sabes con situaciones reales.'],
   ['Gramática','Explora las estructuras paso a paso, con explicaciones en español y ejercicios corregidos.'],
   ['Pronunciación','Escucha y practica en voz alta cuando tu navegador lo permita. El reconocimiento de voz no califica tu acento.'],
   ['Progreso','Tu práctica se guarda en este dispositivo. La prueba de nivel requiere conectar el servidor de evaluación.']]};
}
class GlassHero extends HTMLElement{
 connectedCallback(){
  this.abort=new AbortController();this.copy=content(this.dataset.course);
  try{const r=JSON.parse(localStorage.getItem('zoalmon-placement-latest-'+this.dataset.course));if(['A1','A2','B1','B2','C1','C2'].includes(r?.level))this.copy.eyebrow='TU NIVEL ESTIMADO · '+r.level}catch{}
  const d=this.copy,en=this.dataset.course==='en',base=en?'..':'.';
  this.innerHTML=`<div class="glass-stage glass-static"><div class="glass-canvas" aria-hidden="true"></div><div class="glass-surface glass-nav"><a class="glass-wordmark" href="#home"><i aria-hidden="true"></i>${d.brand}</a><nav aria-label="Accesos del curso"><button data-page="cards">Tarjetas</button><button data-page="grammar">Gramática</button><button data-page="progress">Progreso</button></nav><a class="glass-switch" href="${base}/${en?'':'english/'}">${en?'Français A1':'English A2+'}</a></div><section class="glass-surface glass-content" aria-label="Tu espacio de aprendizaje"><p class="glass-eyebrow">${d.eyebrow}</p><h1>${d.lines.join('<br>')}</h1><p class="glass-sub">${d.sub.join('<br>')}</p><div class="glass-actions"><button class="glass-start" data-page="cards">${d.primary}</button><button class="glass-paper">${d.paper}</button></div><small class="glass-credit">© zoalmon</small><a class="glass-meta" href="${base}/placement/?lang=${en?'en':'fr'}">${d.meta}</a></section><section class="glass-definitions" hidden tabindex="-1" aria-label="Cómo aprender"><h2>Una nueva forma de aprender.</h2>${d.terms.map(([term,text])=>`<p><strong>${term}</strong> — ${text}</p>`).join('')}</section><button class="glass-back" hidden>← Volver</button></div>`;
  this.stage=this.querySelector('.glass-stage');
  this.querySelector('.glass-paper').addEventListener('click',()=>this.open(),{signal:this.abort.signal});
  this.querySelector('.glass-back').addEventListener('click',()=>this.back(),{signal:this.abort.signal});
  this.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.stage.classList.contains('glass-reading'))this.back()},{signal:this.abort.signal});
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)this.init();
 }
 async init(){
  try{const {GlassScene}=await import('./scene.js');if(!this.isConnected)return;this.scene=await GlassScene.create(this);if(!this.isConnected)this.scene?.dispose()}
  catch(e){this.useStatic();/* Styled HTML remains usable without WebGL or CDN. */}
 }
 useStatic(){this.stage.classList.add('glass-static');this.querySelectorAll('.glass-surface,.glass-surface [style]').forEach(el=>el.removeAttribute('style'))}
 open(){
  if(this.stage.classList.contains('glass-reading'))return;
  const defs=this.querySelector('.glass-definitions'),back=this.querySelector('.glass-back');
  this.stage.classList.add('glass-reading');defs.hidden=false;back.hidden=false;
  this.querySelectorAll('.glass-surface').forEach(x=>{x.inert=true});
  this.scene?.shatter();
  clearTimeout(this.focusTimer);this.focusTimer=setTimeout(()=>{if(this.isConnected)back.focus({preventScroll:true})},matchMedia('(prefers-reduced-motion: reduce)').matches?0:750);
 }
 back(){
  this.stage.classList.remove('glass-reading');this.querySelectorAll('.glass-surface').forEach(x=>{x.inert=false});
  this.scene?.returnHome();
  clearTimeout(this.focusTimer);this.focusTimer=setTimeout(()=>{this.querySelector('.glass-definitions').hidden=true;this.querySelector('.glass-back').hidden=true;this.querySelector('.glass-paper').focus({preventScroll:true})},250);
 }
 disconnectedCallback(){clearTimeout(this.focusTimer);this.abort?.abort();this.scene?.dispose()}
}
customElements.define('glass-hero',GlassHero);
