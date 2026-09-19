import {createServer} from 'node:http';
import {readFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname,relative,isAbsolute} from 'node:path';
import {parseEnv} from 'node:util';
import {LocalDB} from './local-db.mjs';
import worker from '../server/worker.mjs';
const root=resolve(import.meta.dirname,'..'),port=Number(process.env.PORT || 8787);
await mkdir(resolve(root,'.local'),{recursive:true});
const DB=new LocalDB(resolve(root,process.env.BK_TEST_PREVIEW?'.local/test-preview.sqlite':'.local/store.sqlite'));
DB.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const name of (await readdir(resolve(root,'migrations'))).filter(n=>n.endsWith('.sql')).sort()) {
  if(await DB.prepare('SELECT name FROM local_migrations WHERE name=?').bind(name).first())continue;
  DB.exec(await readFile(resolve(root,'migrations',name),'utf8'));
  await DB.prepare('INSERT INTO local_migrations(name) VALUES(?)').bind(name).run();
}
let vars={};try{if(!process.env.BK_TEST_PREVIEW)vars=parseEnv(await readFile(resolve(root,'.dev.vars'),'utf8'));}catch{}
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.pdf':'application/pdf'};
const env={STORE_MODE:'preview',SQUARE_ENVIRONMENT:'sandbox',SITE_URL:`http://localhost:${port}`,...vars,DB,ASSETS:{async fetch(req){let path=decodeURIComponent(new URL(req.url).pathname);if(path.endsWith('/'))path+='index.html';const file=resolve(root,'dist','.'+path),relativePath=relative(resolve(root,'dist'),file);if(relativePath.startsWith('..') || isAbsolute(relativePath))return new Response('Not found',{status:404});try{return new Response(await readFile(file),{headers:{'Content-Type':types[extname(file)] || 'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}}};
createServer(async(req,res)=>{
  try{const chunks=[];for await(const chunk of req){chunks.push(chunk);if(chunks.reduce((n,b)=>n+b.length,0)>1100000){res.writeHead(413);res.end();return;}}
    const r=new Request(`http://localhost:${port}${req.url}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
    const response=await worker.fetch(r,env,{waitUntil:p=>p.catch(()=>{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Local server error.');}
}).listen(port,'127.0.0.1',()=>console.log(`Blue Koi preview: http://localhost:${port} (mode: ${env.STORE_MODE})`));
