import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {bank} from '../assessment/bank.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const dir=await mkdtemp(join(tmpdir(),'zoalmon-qa-'));
process.env.PLACEMENT_DATA_FILE=join(dir,'sessions.json');
const {createServer}=await import('../server.mjs');
const server=createServer({apiKey:''});server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/placement/?lang=fr');await page.locator('#start').click();await page.locator('#answer-form').waitFor();
  await page.reload();await page.locator('#resume').click();await page.locator('#answer-form').waitFor();
  const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('zoalmon-placement-session--fr')));
  for(let i=0;i<40;i++){
   const info=await(await fetch(base+'/api/placement/'+id)).json();if(info.result)break;
   const item=bank.find(q=>q.id===info.question.id);
   if(item.options)await page.locator('input[type=radio][value="'+info.question.options.indexOf(item.options[item.answer])+'"]').check();
   else await page.locator('#written').fill(item.answer);
   const response=page.waitForResponse(r=>r.url().endsWith('/answer')&&r.request().method()==='POST');
   await page.locator('button[type=submit]').click();await response;
   await page.waitForFunction(()=>!document.querySelector('button[type=submit]')?.disabled);
  }
  await page.getByRole('heading',{name:/estimado/}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(base+'/');await page.getByText(/TU NIVEL ESTIMADO/).waitFor();
  await page.goto(base+'/placement/?lang=en');assert.equal(await page.locator('.history').count(),0);
  assert.deepEqual(errors,[]);console.log(width+'px: resume, full adaptive test, results, homepage recommendation and separate language history passed');
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
