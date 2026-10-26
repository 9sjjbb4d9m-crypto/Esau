import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {layout} from './hero.js';
const TAU=Math.PI*2,clamp=THREE.MathUtils.clamp;
function inset(poly,gap){
 const area=poly.reduce((s,a,i)=>{const b=poly[(i+1)%poly.length];return s+a[0]*b[1]-a[1]*b[0]},0),sgn=Math.sign(area);
 const lines=poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return {p:[a[0]-dy/len*gap*sgn,a[1]+dx/len*gap*sgn],d:[dx,dy]}});
 return lines.map((b,i)=>{const a=lines[(i+lines.length-1)%lines.length],cross=a.d[0]*b.d[1]-a.d[1]*b.d[0];if(Math.abs(cross)<1e-6)return b.p;const dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],t=(dx*b.d[1]-dy*b.d[0])/cross;return[a.p[0]+a.d[0]*t,a.p[1]+a.d[1]*t]});
}
function rounded(poly,r){
 const shape=new THREE.Shape(),points=poly.map((b,i)=>{const a=poly[(i+poly.length-1)%poly.length],c=poly[(i+1)%poly.length];const l1=Math.hypot(a[0]-b[0],a[1]-b[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),d=Math.min(r,l1*.22,l2*.22);return {b,a:[b[0]+(a[0]-b[0])*d/l1,b[1]+(a[1]-b[1])*d/l1],c:[b[0]+(c[0]-b[0])*d/l2,b[1]+(c[1]-b[1])*d/l2]}});
 shape.moveTo(...points[0].a);
 for(const p of points){shape.lineTo(...p.a);shape.quadraticCurveTo(...p.b,...p.c)}
 shape.closePath();return shape;
}
function text(ctx,str,x,y,font,color,tracking=0){
 ctx.font=font;ctx.fillStyle=color;ctx.textBaseline='top';
 if('letterSpacing'in ctx)ctx.letterSpacing=tracking+'px';
 ctx.fillText(str,x,y);
}
function canvas(w,h){
 const c=document.createElement('canvas'),d=Math.min(2,Math.max(1.5,devicePixelRatio));c.width=Math.ceil(w*d);c.height=Math.ceil(h*d);
 const ctx=c.getContext('2d');ctx.scale(d,d);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;return{canvas:c,ctx,texture,d};
}
function quadTransform(el,points,w,h){
 // Solve the 8-unknown projective transform: panel rectangle -> projected plane.
 const source=[[0,0],[w,0],[w,h],[0,h]],a=[];
 source.forEach(([x,y],i)=>{const [u,v]=points[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v])});
 for(let i=0;i<8;i++){let pivot=i;for(let j=i+1;j<8;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;[a[i],a[pivot]]=[a[pivot],a[i]];const n=a[i][i];if(Math.abs(n)<1e-10)return;for(let k=i;k<9;k++)a[i][k]/=n;for(let j=0;j<8;j++)if(j!==i){const f=a[j][i];for(let k=i;k<9;k++)a[j][k]-=f*a[i][k]}}
 const m=a.map(r=>r[8]);const transform='matrix3d('+[m[0],m[3],0,m[6],m[1],m[4],0,m[7],0,0,1,0,m[2],m[5],0,1].map((n,i)=>Number(n.toFixed(i===3||i===7?9:4))).join(',')+')';if(el.style.transform!==transform)el.style.transform=transform;
}
export class GlassScene{
 static async create(host){
  const self=new GlassScene(host);
  try{self.setup();await document.fonts.load('500 20px InterGlass');if(!host.isConnected){self.dispose();return null}self.resize();self.start();return self}catch(e){self.dispose();throw e}
 }
 constructor(host){this.host=host;this.stage=host.stage;this.mode='enter';this.modeAt=performance.now()/1000;this.pointer=new THREE.Vector2(10,10);this.active=false;this.pieces=[];this.textures=[];this.elapsed=0;this.disposed=false;this.abort=new AbortController();this.hovered=null;this.pill=false;this.paperHover=false;this.navHover='';this.glow={value:0};this.glowPos={value:new THREE.Vector3(10000,10000,0)}}
 setup(){
  this.renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'high-performance'});
  this.renderer.setClearColor(0x050507);this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
  this.host.querySelector('.glass-canvas').append(this.renderer.domElement);
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(30,1,.1,10000);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);this.env=pmrem.fromScene(room,.04);this.scene.environment=this.env.texture;this.scene.environmentIntensity=.42;room.dispose();pmrem.dispose();
  this.key=new THREE.DirectionalLight(0xcfdfff,3.5);this.scene.add(this.key);this.scene.add(new THREE.AmbientLight(0x9aa7c8,.35));
  this.slab=new THREE.Group();this.scene.add(this.slab);this.ray=new THREE.Raycaster();
  for(let i=0;i<6;i++){
   const group=new THREE.Group(),material=this.material(true);this.slab.add(group);
   const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material),print=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
   group.add(mesh,print);mesh.userData.piece=i;
   const p={group,mesh,print,material,hover:0,v:0,lift:0,base:new THREE.Vector3(),angle:new THREE.Vector2(),axis:new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize(),random:Math.random(),tumble:2+Math.random()*1.6};
   this.pieces.push(p);
  }
  this.backGroup=new THREE.Group();this.scene.add(this.backGroup);
  this.backMaterial=this.material(false);this.backMaterial.iridescence=.35;
  this.backMesh=new THREE.Mesh(new THREE.BufferGeometry(),this.backMaterial);this.backGroup.add(this.backMesh);
  this.backText=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false}));this.backGroup.add(this.backText);
  this.onMove=e=>{const r=this.stage.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);this.active=true};
  this.stage.addEventListener('pointermove',this.onMove,{signal:this.abort.signal});
  this.stage.addEventListener('pointerleave',()=>{this.active=false;this.hovered=null},{signal:this.abort.signal});
  window.addEventListener('blur',()=>{this.active=false},{signal:this.abort.signal});
  this.stage.addEventListener('pointerover',e=>{this.pill=!!e.target.closest('.glass-start');this.paperHover=!!e.target.closest('.glass-paper');this.navHover=e.target.closest('.glass-nav button')?.textContent||'';this.paint()},{signal:this.abort.signal});
  this.stage.addEventListener('pointerout',e=>{if(e.target.closest('.glass-start,.glass-paper,.glass-nav button')){this.pill=false;this.paperHover=false;this.navHover='';this.paint()}},{signal:this.abort.signal});
  this.observer=new ResizeObserver(()=>{if(!this.disposed)this.resize()});this.observer.observe(this.stage);
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.host.useStatic();this.dispose()},{signal:this.abort.signal});
 }
 material(glow){
  const m=new THREE.MeshPhysicalMaterial({color:0x17171b,roughness:.36,clearcoat:.7,clearcoatRoughness:.12,specularIntensity:.7,iridescence:.55,iridescenceIOR:1.3,iridescenceThicknessRange:[250,650],envMapIntensity:1,metalness:.12});
  if(glow)m.onBeforeCompile=shader=>{
   shader.uniforms.uGlow=this.glow;shader.uniforms.uPointer=this.glowPos;shader.uniforms.uRadius={value:300*(this.L?.s||1)};m.userData.shader=shader;
   shader.vertexShader='varying vec3 vGlassWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGlassWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
   shader.fragmentShader='uniform float uGlow;uniform vec3 uPointer;uniform float uRadius;varying vec3 vGlassWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat gd=distance(vGlassWorld,uPointer)/uRadius;totalEmissiveRadiance+=vec3(.42,.37,.62)*.16*exp(-1.6*gd*gd)*uGlow;');
  };
  return m;
 }
 resize(){
  if(this.disposed)return;const w=this.stage.clientWidth,h=this.stage.clientHeight;if(!w||!h)return;
  this.L=layout(w,h);const L=this.L;
  this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.position.z=h/(2*Math.tan(Math.PI/12));this.camera.far=this.camera.position.z+6000;this.camera.updateProjectionMatrix();
  this.key.position.set(-w*.6,h*.9,900);
  this.textures.forEach(x=>x.dispose());this.textures=[];
  this.page=canvas(L.bw,L.ph);this.nav=canvas(L.bw,L.nh);this.textures.push(this.page.texture,this.nav.texture);
  this.pieces.forEach((p,i)=>{p.print.material.map=i===0?this.nav.texture:this.page.texture;p.print.material.needsUpdate=true;if(p.material.userData.shader)p.material.userData.shader.uniforms.uRadius.value=300*L.s});
  this.paint();this.cut(performance.now()/1000);this.domLayout();this.buildBack();
 }
 paint(){
  if(!this.page)return;const L=this.L,d=this.host.copy,c=this.page.ctx;
  c.clearRect(0,0,L.bw,L.ph);
  text(c,d.eyebrow,L.tx,L.eye,'400 '+L.small+'px InterGlass','rgba(255,255,255,.38)',L.small*.2);
  const grad=c.createLinearGradient(0,L.hy,0,L.hy+L.font*2);grad.addColorStop(0,'#dcdce0');grad.addColorStop(1,'#bdbdc3');
  d.lines.forEach((line,i)=>text(c,line,L.tx,L.hy+i*L.font*.97,'500 '+L.font+'px InterGlass',grad,-L.font*.045));
  c.font='400 '+L.subFont+'px InterGlass';c.letterSpacing='0px';
  const subLines=[];
  for(const line of d.sub){let buffer='';for(const word of line.split(' ')){const next=buffer?buffer+' '+word:word;if(buffer&&c.measureText(next).width>L.bw*.85){subLines.push(buffer);buffer=word}else buffer=next}subLines.push(buffer)}
  L.subLines=subLines;
  subLines.forEach((line,i)=>text(c,line,L.tx,L.subY+i*L.subFont*1.65,'400 '+L.subFont+'px InterGlass','rgba(255,255,255,.55)'));
  const ay=L.subY+L.subFont*1.65*L.subLines.length+(L.phone?28:30*L.s);L.ay=ay;
  c.fillStyle=this.pill?'#36d67e':'#dedee3';c.beginPath();c.roundRect(L.tx,ay,L.pillW,L.pillH,6);c.fill();
  const fs=L.phone?12:14*L.s;c.font='500 '+fs+'px InterGlass';c.letterSpacing='0px';
  text(c,d.primary,L.tx+(L.pillW-c.measureText(d.primary).width)/2,ay+(L.pillH-fs)/2,'500 '+fs+'px InterGlass','#111115');
  const linkX=L.tx+L.pillW+(L.phone?22:28*L.s);text(c,d.paper,linkX,ay+(L.pillH-fs)/2,'400 '+fs+'px InterGlass','#bdbdc5');
  if(this.paperHover){c.strokeStyle='#bdbdc5';c.beginPath();c.moveTo(linkX,ay+L.pillH*.76);c.lineTo(linkX+c.measureText(d.paper).width,ay+L.pillH*.76);c.stroke()}
  text(c,'© zoalmon',L.bw*.055,L.ph*.94-L.small,'400 '+L.small+'px InterGlass','#ffffff57');
  c.font='400 '+L.small+'px InterGlass';text(c,d.meta,L.bw*.945-c.measureText(d.meta).width,L.ph*.94-L.small,'400 '+L.small+'px InterGlass','#ffffff57');
  this.page.texture.needsUpdate=true;
  const n=this.nav.ctx;n.clearRect(0,0,L.bw,L.nh);const navfs=L.phone?13:20*L.s,mid=L.nh/2;
  n.fillStyle='#dcdce0';n.fillRect(L.bw*.035,mid-6,12,12);
  text(n,d.brand,L.bw*.035+22,mid-navfs/2,'550 '+navfs+'px InterGlass','#dddde2');
  const navItems=L.phone?['Tarjetas','Gramática']:['Tarjetas','Gramática','Progreso'],nfs=L.phone?10:13*L.s;
  n.font='400 '+nfs+'px InterGlass';n.letterSpacing='0px';
  const space=L.phone?14:32*L.s,navWidth=navItems.reduce((sum,x)=>sum+n.measureText(x).width,0)+space*(navItems.length-1);let nx=L.phone?L.bw*.47:(L.bw-navWidth)/2;
  navItems.forEach(item=>{text(n,item,nx,mid-nfs/2,'400 '+nfs+'px InterGlass',this.navHover===item?'#fff':'#ffffff99');nx+=n.measureText(item).width+space});
  const other=this.host.dataset.course==='en'?'Français A1':'English A2+',otherfs=L.phone?9:13*L.s;n.font='400 '+otherfs+'px InterGlass';
  text(n,other,L.bw*.965-n.measureText(other).width,mid-otherfs/2,'400 '+otherfs+'px InterGlass','#bfbfc6');
  this.nav.texture.needsUpdate=true;
 }
 domLayout(){
  const L=this.L,nav=this.host.querySelector('.glass-nav'),page=this.host.querySelector('.glass-content');
  nav.style.width=L.bw+'px';nav.style.height=L.nh+'px';page.style.width=L.bw+'px';page.style.height=L.ph+'px';
  page.style.setProperty('--headline',L.font+'px');page.style.setProperty('--small',L.small+'px');page.style.setProperty('--subfont',L.subFont+'px');page.style.setProperty('--pillw',L.pillW+'px');page.style.setProperty('--pillh',L.pillH+'px');page.style.setProperty('--actiongap',(L.phone?22:28*L.s)+'px');
  for(const [sel,y] of [['.glass-eyebrow',L.eye],['h1',L.hy],['.glass-sub',L.subY],['.glass-actions',L.ay]]){const el=page.querySelector(sel);el.style.top=y+'px';el.style.left=L.tx+'px'}
  page.querySelectorAll('.glass-actions button').forEach(b=>b.style.fontSize=(L.phone?12:14*L.s)+'px');
  page.querySelector('.glass-sub').innerHTML=L.subLines.join('<br>');
  const navfs=L.phone?13:20*L.s,nfs=L.phone?10:13*L.s,otherfs=L.phone?9:13*L.s;
  const ctx=this.nav.ctx;ctx.font='400 '+nfs+'px InterGlass';ctx.letterSpacing='0px';
  const items=L.phone?['Tarjetas','Gramática']:['Tarjetas','Gramática','Progreso'],space=L.phone?14:32*L.s,total=items.reduce((sum,x)=>sum+ctx.measureText(x).width,0)+space*(items.length-1);
  const wordmark=nav.querySelector('.glass-wordmark');
  Object.assign(wordmark.style,{position:'absolute',left:L.bw*.035+'px',top:(L.nh-44)/2+'px',height:'44px',lineHeight:'1',fontSize:navfs+'px'});
  Object.assign(wordmark.querySelector('i').style,{width:'12px',height:'12px'});
  Object.assign(nav.querySelector('nav').style,{position:'absolute',left:(L.phone?L.bw*.47:(L.bw-total)/2)+'px',top:(L.nh-44)/2+'px',gap:space+'px',height:'44px'});
  nav.querySelectorAll('nav button').forEach(b=>Object.assign(b.style,{fontSize:nfs+'px',height:'44px',lineHeight:'44px',padding:'0',display:L.phone&&b.dataset.page==='progress'?'none':'block'}));
  Object.assign(nav.querySelector('.glass-switch').style,{position:'absolute',right:L.bw*.035+'px',top:(L.nh-44)/2+'px',height:'44px',lineHeight:'44px',fontSize:otherfs+'px'});
  this.domNav=nav;this.domPage=page;
 }
 vertices(time){
  const L=this.L;
  const point=(x,y,i,junction=false)=>{
   const edge=x===0||x===1||y===0||y===1;
   if(x!==0&&x!==1)x+=.03*Math.sin(time*(.32+i*.018)+i*1.72);
   if(junction)y+=.05*Math.sin(time*(.36+i*.01)+i*2.1);
   if(this.active&&this.mode==='home'){
    const px=(this.pointer.x*L.w*.5+L.bw/2)/L.bw,py=(-this.pointer.y*L.h*.5+L.py+L.ph/2)/L.ph,dx=x-px,dy=y-py,dist=Math.hypot(dx,dy);
    if(dist<.6&&dist>.001){const f=.05*(1-dist/.6);if(x!==0&&x!==1)x+=dx/dist*f;if(junction)y+=dy/dist*f}
   }
   return [x,y];
  };
  const pts={tl:[0,0],tr:[1,0],bl:[0,1],br:[1,1],ab:point(.22,0,1),bc:point(.515,0,2),ce:point(.84,0,3),ad:point(.34,1,4),de:point(.865,1,5),j0:point(.385,.72,6,true),j1:point(.48,.62,7,true),j2:point(.716,.49,8,true)};
  return [['tl','ab','j0','ad','bl'],['ab','bc','j1','j0'],['bc','ce','j2','j1'],['j0','j1','j2','de','ad'],['ce','tr','br','de','j2']].map(keys=>keys.map(k=>{let[x,y]=pts[k];if(L.phone)[x,y]=[y,x];return[x*L.bw,y*L.ph]}));
 }
 cut(time){
  const L=this.L,polys=this.vertices(time);
  this.pieces.forEach((p,i)=>{
   const poly=i===0?[[0,0],[L.bw,0],[L.bw,L.nh],[0,L.nh]]:polys[i-1],height=i===0?L.nh:L.ph;
   const inner=inset(poly,i===0?0:7*L.s),cx=inner.reduce((s,a)=>s+a[0],0)/inner.length,cy=inner.reduce((s,a)=>s+a[1],0)/inner.length;
   p.cx=cx;p.cy=cy;p.base.set(cx-L.bw/2,(i===0?L.ny:L.py)+height/2-cy,0);
   const shape=rounded(inner.map(([x,y])=>[x-cx,cy-y]),20*L.s);
   const geo=new THREE.ExtrudeGeometry(shape,{depth:13*L.s,bevelEnabled:true,bevelThickness:2.6*L.s,bevelSize:2.6*L.s,bevelSegments:3,steps:1,curveSegments:4});
   const face=new THREE.ShapeGeometry(shape,4),pos=face.attributes.position,uv=face.attributes.uv;
   for(let j=0;j<pos.count;j++)uv.setXY(j,(pos.getX(j)+cx)/L.bw,1-(cy-pos.getY(j))/height);
   p.mesh.geometry.dispose();p.mesh.geometry=geo;p.print.geometry.dispose();p.print.geometry=face;p.print.position.z=15.6*L.s+.35;
  });
 }
 buildBack(){
  const L=this.L,k=L.w/1918,coords=L.phone?[[.04,.18],[.28,.115],[.35,.19],[.05,.205]]:[[.147,.243],[.252,.169],[.287,.277],[.151,.258]];
  const cx=coords.reduce((s,p)=>s+p[0],0)/4*L.w-L.w/2,cy=L.h/2-coords.reduce((s,p)=>s+p[1],0)/4*L.h;
  this.backCenter=new THREE.Vector3(cx,cy,0);
  const shape=rounded(coords.map(([x,y])=>[x*L.w-L.w/2-cx,L.h/2-y*L.h-cy]),Math.max(2,5*k));
  this.backMesh.geometry.dispose();this.backMesh.geometry=new THREE.ExtrudeGeometry(shape,{depth:11*k,bevelEnabled:true,bevelThickness:1.5*k,bevelSize:1.5*k,bevelSegments:3,curveSegments:5});
  const label=canvas(180,50);text(label.ctx,'← Volver',90-32,18,'500 13px InterGlass','#fff');label.texture.needsUpdate=true;
  if(this.backLabel)this.backLabel.texture.dispose();this.backLabel=label;
  this.backText.material.map=label.texture;this.backText.material.needsUpdate=true;this.backText.scale.set(L.phone?150:180*k,L.phone?42:50*k,1);
  const tx=(L.phone?.20:.219)*L.w-L.w/2-cx,ty=L.h/2-(L.phone?.18:.238)*L.h-cy;this.backText.position.set(tx,ty,12*k+1);
 }
 project(x,y,z=0){
  const v=new THREE.Vector3(x,y,z);this.slab.localToWorld(v);v.project(this.camera);return[(v.x*.5+.5)*this.L.w,(-v.y*.5+.5)*this.L.h];
 }
 syncDOM(){
  const L=this.L,z=15.6*L.s+.35;
  for(const [el,y,h] of [[this.domNav,L.ny,L.nh],[this.domPage,L.py,L.ph]]){
   const pts=[[-L.bw/2,y+h/2],[L.bw/2,y+h/2],[L.bw/2,y-h/2],[-L.bw/2,y-h/2]].map(([x,y])=>this.project(x,y,z));
   quadTransform(el,pts,L.bw,h);
  }
 }
 start(){
  this.stage.classList.remove('glass-static');this.modeAt=performance.now()/1000;this.last=performance.now()/1000;this.lastCut=0;this.renderer.setAnimationLoop(()=>this.frame());
 }
 shatter(){this.mode='shatter';this.modeAt=performance.now()/1000}
 returnHome(){this.returning=true;this.mode='enter';this.modeAt=performance.now()/1000}
 frame(){
  if(this.disposed)return;
  const now=performance.now()/1000,dt=Math.min(.033,now-this.last);this.last=now;const L=this.L,t=now-this.modeAt;
  if(this.mode==='enter'&&t>1.1)this.mode='home';
  if(this.mode==='shatter'&&t>1.1)this.mode='paper';
  const home=this.mode==='home'||this.mode==='enter';
  const goalY=this.active&&home?this.pointer.x*7*Math.PI/180-1.2*Math.PI/180:0,goalX=this.active&&home?this.pointer.y*5.5*Math.PI/180+.8*Math.PI/180:0,a=1-Math.exp(-dt/.3);
  this.slab.rotation.y+=(goalY-this.slab.rotation.y)*a;this.slab.rotation.x+=(goalX-this.slab.rotation.x)*a;
  if(Math.abs(this.slab.rotation.x-goalX)<.00001)this.slab.rotation.x=goalX;if(Math.abs(this.slab.rotation.y-goalY)<.00001)this.slab.rotation.y=goalY;
  this.slab.updateMatrixWorld(true);this.camera.updateMatrixWorld();this.ray.setFromCamera(this.pointer,this.camera);
  const hits=this.active&&home?this.ray.intersectObjects(this.pieces.map(p=>p.mesh)):[];this.hovered=hits[0]?.object.userData.piece??null;
  const point=new THREE.Vector3();if(this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),point))this.glowPos.value.copy(point);
  this.glow.value+=((this.active&&home?1:0)-this.glow.value)*a;
  if(now-this.lastCut>1/45&&home){this.cut(now);this.lastCut=now}
  this.pieces.forEach((p,i)=>{
   const target=this.hovered===i?1:0;p.hover+=(target-p.hover)*(1-Math.exp(-dt*12));
   const lift=target*(i===0?32:50)*L.s;p.v+=(170*(lift-p.lift)-19*p.v)*dt;p.lift+=p.v*dt;
   const offset=clamp((t-i*.03)/.72,0,1);let fly=0;
   if(this.mode==='enter'){const c1=1.3,c3=c1+1,ease=1+c3*(offset-1)**3+c1*(offset-1)**2;fly=1-ease}
   else if(this.mode==='shatter')fly=offset**3;
   else if(this.mode==='paper')fly=1;
   const bx=p.base.x,by=p.base.y,sign=bx>=0?1:-1;
   p.group.position.copy(p.base);p.group.position.x+=fly*(sign*(200+Math.abs(bx)*.5)*L.s);p.group.position.y-=fly*(220+L.ph*.3)*L.s+fly*fly*180*L.s;p.group.position.z=p.lift+fly*(420+p.random*380)*L.s;
   const tipX=this.hovered===i?clamp((point.y-by)/L.ph,-1,1)*.48:0,tipY=this.hovered===i?-clamp((point.x-bx)/L.bw,-1,1)*.48:0;
   p.angle.x+=(tipX-p.angle.x)*a*2;p.angle.y+=(tipY-p.angle.y)*a*2;
   p.group.quaternion.setFromEuler(new THREE.Euler(p.angle.x,p.angle.y,0));p.group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(p.axis,p.tumble*fly));
   p.material.iridescence=.55+.45*p.hover;p.material.envMapIntensity=1+.9*p.hover;p.group.visible=this.mode!=='paper';
  });
  let backScale=0;if(this.mode==='shatter'||this.mode==='paper')backScale=clamp((t-.3)/.4,0,1);else if(this.mode==='enter'&&this.returning)backScale=1-clamp(t/.25,0,1);
  if(this.mode==='home')backScale=0;this.backGroup.visible=backScale>0;
  if(this.backCenter){this.backGroup.position.copy(this.backCenter);this.backGroup.scale.setScalar(backScale);const bh=this.active&&this.ray.intersectObject(this.backMesh).length>0;
   this.backGroup.rotation.set(.08+Math.sin(now*TAU*.8)*.03+(bh?this.pointer.y*.14:0),-.16+Math.sin(now*TAU*.93)*.04+(bh?this.pointer.x*.14:0),0);
   if(bh!==this.backHovered){this.backHovered=bh;this.backLabel.ctx.clearRect(0,0,180,50);text(this.backLabel.ctx,'← Volver',58,18,'500 13px InterGlass',bh?'#b9abff':'#fff');this.backLabel.texture.needsUpdate=true}
  }
  this.scene.updateMatrixWorld(true);this.syncDOM();this.renderer.render(this.scene,this.camera);
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.abort.abort();this.observer?.disconnect();
  this.renderer?.setAnimationLoop(null);this.scene?.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});
  this.textures.forEach(t=>t.dispose());this.backLabel?.texture.dispose();this.env?.dispose();this.renderer?.dispose();this.renderer?.domElement.remove();
 }
}
