import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {validateExercise,words} from './public/core.js';
const root=fileURLToPath(new URL('./public/',import.meta.url));
export function createServer({apiKey=process.env.OPENAI_API_KEY,fetcher=fetch}={}){return http.createServer(async(req,res)=>{
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/config')return send(200,{aiEnabled:!!apiKey});
 if(url.pathname==='/api/exercise'){
 if(req.method!=='POST')return send(405,{error:'Use POST.'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return send(403,{error:'Origin not allowed.'});
 if(!apiKey)return send(503,{error:'AI is not configured. Try a built-in exercise.'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return send(413,{error:'Request too large.'});}let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Invalid JSON.'});}
 const deck=String(input.deck||'All topics');const vocabulary=words.filter(w=>deck==='All topics'||w.deck===deck).map(w=>w.fr).join(', ');if(!vocabulary)return send(400,{error:'Unknown topic.'});
 const upstream=await fetcher('https://api.openai.com/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',response_format:{type:'json_object'},messages:[{role:'system',content:'Create one beginner A1 French multiple-choice exercise using the vocabulary provided. English instructions and explanation. Return JSON only: {prompt:string,options:[four distinct strings],answer:integer index 0-3,explanation:string}. Be accurate.'},{role:'user',content:vocabulary}],max_tokens:600})});
 if(!upstream.ok)return send(502,{error:'The AI provider could not complete the request. Try a built-in exercise.'});
 const data=await upstream.json();return send(200,validateExercise(JSON.parse(data.choices[0].message.content)));
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return send(405,{error:'Method not allowed.'});
 const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),path=resolve(root,'.'+name);if(!path.startsWith(root))return send(403,{error:'Forbidden.'});
 const file=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'})[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:file);
 }catch(e){send(e.code==='ENOENT'?404:502,{error:e.code==='ENOENT'?'Not found.':'Request failed. Please try again.'});}
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT)||3000;createServer().listen(port,'127.0.0.1',()=>console.log(`Parlons is ready at http://localhost:${port}`));}
