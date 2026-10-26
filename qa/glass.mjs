const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from '../server.mjs';
const s=createServer({apiKey:''});s.listen(0,'127.0.0.1');await once(s,'listening');const base='http://127.0.0.1:'+s.address().port;
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await b.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/english/');
 await page.waitForFunction(()=>document.querySelector('glass-hero')?.scene?.mode==='home',{},{timeout:30000});
 assert.equal(await page.locator('.glass-stage').evaluate(e=>e.classList.contains('glass-static')),false);
 assert.equal(await page.locator('glass-hero').evaluate(e=>e.scene.pieces.length),6);
 // Software rendering still exercises the actual geometry, shader and raycasting.
 await page.mouse.move(260,370);await page.waitForTimeout(1800);
 const hover=await page.locator('glass-hero').evaluate(e=>({lift:e.scene.pieces.map(x=>x.lift),tilt:e.scene.slab.rotation.y,shader:!!e.scene.pieces[1].material.userData.shader}));
 assert.ok(hover.lift.some(x=>x>0));assert.ok(hover.tilt!==0);assert.ok(hover.shader);
 await page.locator('.glass-paper').click({force:true});await page.waitForFunction(()=>document.querySelector('glass-hero')?.scene?.mode==='paper');
 await page.locator('.glass-definitions').waitFor({state:'visible'});
 await page.locator('.glass-back').click({force:true});await page.waitForFunction(()=>document.querySelector('glass-hero')?.scene?.mode==='home');
 await page.locator('.glass-start').click({force:true});await page.getByRole('heading',{name:'Una palabra cada vez.'}).waitFor();
 assert.equal(await page.locator('canvas').count(),0);
 assert.deepEqual(errors,[]);await page.close();
 for(const course of ['/','/english/']){
  const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await p.goto(base+course);
  assert.equal(await p.locator('canvas').count(),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.locator('.glass-paper').click();await p.locator('.glass-back').click();await p.locator('.glass-start').click();
  assert.equal(await p.locator('glass-hero').count(),0);await p.close();
 }
 // Failed CDN / disabled WebGL retain real HTML links and controls.
 const p=await b.newPage({viewport:{width:390,height:844}});
 await p.route('https://cdn.jsdelivr.net/npm/three**',r=>r.abort());await p.goto(base+'/');
 await p.locator('.glass-start').click();await p.getByRole('heading',{name:'One word at a time.'}).waitFor();await p.close();
 console.log('WebGL: geometry, shader, pointer lift/tilt, shatter, reassembly, real navigation, cleanup, mobile/reduced-motion and CDN fallback passed.');
}finally{await b.close();await new Promise(r=>s.close(r))}
