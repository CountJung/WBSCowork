/** Full production bundle in workerd, with ephemeral D1/R2 and a loopback gateway. */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Miniflare,Log,LogLevel } from "miniflare";
import { encode } from "next-auth/jwt";
const origin="https://screenshots.example.test",secret=randomBytes(32).toString("hex");
async function modules(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())result.push(...await modules(file));else if(file.endsWith(".js"))result.push({type:"ESModule",path:file});}return result;}
const mf=new Miniflare({cf:false,name:"bug-screenshot-browser",modules:[{type:"ESModule",path:path.resolve("dist/server/index.js")},...(await modules(path.resolve("dist/server"))).filter(m=>m.path!==path.resolve("dist/server/index.js"))],modulesRoot:path.resolve("dist/server"),scriptPath:path.resolve("dist/server/index.js"),compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"bug-screenshot-browser-db"},r2Buckets:{ATTACHMENTS:"bug-screenshot-browser-files"},assets:{directory:path.resolve("dist/client"),binding:"ASSETS",routerConfig:{invoke_user_worker_ahead_of_assets:false,has_user_worker:true}},bindings:{NEXTAUTH_SECRET:secret,NEXTAUTH_URL:origin,GOOGLE_CLIENT_ID:"synthetic.apps.googleusercontent.com",GOOGLE_CLIENT_SECRET:"synthetic-not-credential",SUPERUSER_EMAIL:"admin@example.test"},log:new Log(LogLevel.ERROR)});
let root;
const server=createServer(async(req,res)=>{
 try {
  const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v&&!['host','connection','content-length'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);
  const token=req.headers.cookie?.match(/(?:^|;\s*)next-auth.session-token=([^;]+)/)?.[1];if(token)headers.set('Cookie',`__Secure-next-auth.session-token=${token}`);
  // Browser actions remain local: replace only the gateway origin with mf.ready's accepted action origin.
  if(headers.get('Origin')===root)headers.set('Origin',new URL(await mf.ready).origin);
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const response=await mf.dispatchFetch(origin+req.url,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined,redirect:'manual'});
  const outgoing={};for(const[k,v]of response.headers)if(!['content-encoding','content-length','transfer-encoding','set-cookie'].includes(k))outgoing[k]=v;
  res.writeHead(response.status,outgoing);res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error.message);res.writeHead(500);res.end('Synthetic gateway error');}
});
try {
 const db=await mf.getD1Database('DB');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO users(id,email,name,role) VALUES(1,'guest@example.test','Synthetic Guest','guest')").run();
 const token=await encode({secret,token:{email:'guest@example.test',name:'Synthetic Guest'},maxAge:3600});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root=`http://127.0.0.1:${server.address().port}`;
 const child=spawn('python3',['scripts/test-bug-screenshots-browser.py'],{stdio:['pipe','inherit','inherit']});child.stdin.end(JSON.stringify({url:root,token}));
 const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});if(code!==0)throw new Error(`Screenshot browser exit ${code}`);
}finally{server.close();await mf.dispose();}
