const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {once} from 'node:events';
const server=createServer({apiKey:''});server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 if(process.env.QA_SCREENSHOTS)await page.screenshot({path:process.env.QA_SCREENSHOTS+'/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Start today’s review'}).click();
 await page.getByRole('button',{name:'Reveal translation'}).click();
 await page.getByRole('button',{name:'Good',exact:false}).click();
 let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('parlons-v1')));assert.equal(state.cards['1'].reps,1);assert.equal(state.events.length,1);
 await page.reload();assert.ok(!(await page.locator('.word').textContent()).includes('bonjour'));
 await page.locator('nav [data-page="quiz"]').click();
 for(let i=0;i<5;i++){await page.locator('[data-answer="0"]').click();if(i===0){await page.locator('nav [data-page="home"]').click();await page.locator('nav [data-page="quiz"]').click();await page.locator('.feedback').waitFor();}await page.locator('[data-action="next-quiz"]').click();}
 await page.getByText('QUIZ COMPLETE',{exact:true}).waitFor();
 state=await page.evaluate(()=>JSON.parse(localStorage.getItem('parlons-v1')));assert.equal(state.events.filter(e=>e.type==='quiz').length,5);
 await page.locator('nav [data-page="exercises"]').click();await page.locator('[data-action="builtin"]').click();await page.locator('[data-ex-answer="0"]').click();await page.locator('.feedback').waitFor();await page.locator('nav [data-page="home"]').click();await page.locator('nav [data-page="exercises"]').click();await page.locator('.feedback').waitFor();
 await page.locator('nav [data-page="progress"]').click();assert.equal(await page.locator('.word-row').count(),24);
 await page.locator('[data-page="settings"]').click();await page.locator('#goal').selectOption('20');await page.reload();assert.equal(await page.locator('#goal').inputValue(),'20');
 await page.locator('nav [data-page="speak"]').click();await page.locator('[data-action="next-speak"]').click();await page.locator('#topic').selectOption('Getting around');assert.equal(await page.locator('.word').textContent(),'la gare');
 await page.locator('nav [data-page="cards"]').click();await page.locator('#topic').selectOption('At the café');await page.getByRole('button',{name:'Reveal translation'}).click();assert.ok((await page.locator('.translation').textContent()).includes('bread'));
 await page.setViewportSize({width:390,height:844});await page.locator('nav [data-page="home"]').click();if(process.env.QA_SCREENSHOTS)await page.screenshot({path:process.env.QA_SCREENSHOTS+'/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.locator('nav [data-page="cards"]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(errors,[]);console.log('Browser QA passed: reviews, reload persistence, 5-question quiz, exercises, progress, settings, topic filters, mobile overflow, zero runtime errors.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
