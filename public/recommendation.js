export function recommendation(language,base){
 try{
  const r=JSON.parse(localStorage.getItem('zoalmon-placement-latest-'+language)),skills={grammar:'gramática',vocabulary:'vocabulario',reading:'lectura'};
  if(!['A1','A2','B1','B2','C1','C2'].includes(r?.level)||!skills[r.weakest])return '';
  return '<div class="panel" lang="es" style="margin-bottom:32px"><p>Tu nivel estimado: <strong>'+r.level+'</strong>. Prioridad: '+skills[r.weakest]+'.</p><a class="secondary" href="'+base+'/placement/?lang='+language+'">Ver tu ruta y evaluación</a></div>';
 }catch{return ''}
}
