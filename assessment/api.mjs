import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {newSession,submit,publicSession} from './engine.mjs';
export function placementAPI(file){
 let chain=Promise.resolve();
 return async(req,res,url)=>{
  const origin=req.headers.origin,allowed=process.env.PLACEMENT_ORIGIN;
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(origin&&origin===allowed?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})});res.end(JSON.stringify(data))};
  if(origin&&origin!==allowed&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)return send(403,{error:'Origen no autorizado.'});
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin||'', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
  const work=async()=>{
   try{
    let db={};try{db=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
    const path=url.pathname.split('/').filter(Boolean);let session;
    if(req.method==='POST'){
     let raw='';for await(const c of req){raw+=c;if(raw.length>4096)return send(413,{error:'Solicitud demasiado grande.'})}
     let data;try{data=JSON.parse(raw)}catch{return send(400,{error:'JSON inválido.'})}
     if(!data||typeof data!=='object')return send(400,{error:'Solicitud inválida.'});
     if(path.length===2){session=newSession(randomUUID(),data.language,data.expected,Array.isArray(data.previousIds)?data.previousIds.slice(0,100):[]);db[session.id]=session}
     else if(path.length===4&&path[3]==='answer'){session=Object.hasOwn(db,path[2])?db[path[2]]:null;if(!session)return send(404,{error:'Sesión no encontrada.'});submit(session,data.id,data.value,data.elapsed)}
     else return send(404,{error:'Ruta no encontrada.'});
     await mkdir(dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(db));await rename(file+'.tmp',file);
    }else if(req.method==='GET'&&path.length===3){session=Object.hasOwn(db,path[2])?db[path[2]]:null;if(!session)return send(404,{error:'Sesión no encontrada.'})}
    else return send(405,{error:'Método no permitido.'});
    send(200,publicSession(session));
   }catch(e){send(e.message?.includes('inválid')||e.message?.includes('desactualizada')?400:500,{error:e.message?.includes('inválid')||e.message?.includes('desactualizada')?e.message:'No se pudo guardar la sesión. Inténtalo de nuevo.'})}
  };
  const next=chain.then(work,work);chain=next.catch(()=>{});await next;
 };
}
