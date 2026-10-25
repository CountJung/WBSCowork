/** Public manual on the exact Native bundle. No database/accounts or browser processes. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes,createHash } from "node:crypto";
import { mkdir,readFile,writeFile,symlink,stat } from "node:fs/promises";
import path from "node:path";
import next from "next";
import { verifyUserGuide } from "./test-user-guide-http.mjs";
import { buildSnapshot } from "./test-project-ux-provenance.mjs";

assert.equal(process.argv.length,2,"Only the frozen current Native build is supported.");
const out=path.resolve(".test-artifacts/user-guide-native-http"),serverDir=path.join(out,"server");
const roots=[".next/BUILD_ID",".next/server",".next/static",".next/required-server-files.json"],before=await buildSnapshot(roots);
await mkdir(serverDir,{recursive:true});await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,phase:"running"}));
for(const name of [".next","node_modules","public"])try{await stat(path.resolve(name));await symlink(path.resolve(name),path.join(serverDir,name),"dir");}catch(error){if(!["ENOENT","EEXIST"].includes(error.code))throw error;}
await writeFile(path.join(serverDir,"package.json"),JSON.stringify({private:true,type:"module",name:"synthetic-user-guide-native-http"}));
const trace=[],errors=[],secret=randomBytes(32).toString("hex");let app,handler,exitCode=0;
const previousError=console.error;console.error=(...values)=>{errors.push(values.map(String).join(" ").replaceAll(secret,"[synthetic-secret]"));previousError(...values);};
const server=createServer((req,res)=>{res.on("finish",()=>trace.push({route:req.url,method:req.method,status:res.statusCode,contentType:res.getHeader("content-type"),location:res.getHeader("location"),cacheControl:res.getHeader("cache-control")}));handler(req,res);});
try{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 Object.assign(process.env,{NODE_ENV:"production",NEXTAUTH_SECRET:secret,NEXTAUTH_URL:origin,GOOGLE_CLIENT_ID:"synthetic-guide",GOOGLE_CLIENT_SECRET:"synthetic-guide-no-credential",SUPERUSER_EMAIL:"synthetic-guide-su@example.test",DB_HOST:"127.0.0.1",DB_PORT:"1",DB_USER:"synthetic-guide-no-db",DB_PASSWORD:"SYNTHETIC_GUIDE_NO_DB_CONNECTION",DB_NAME:"synthetic_guide_no_connection_test",DB_SCHEMA_USER:"",DB_SCHEMA_PASSWORD:"",DB_CONNECTION_LIMIT:"1",DB_CONNECT_TIMEOUT_MS:"1000",UPLOAD_DIR:path.join(out,"uploads-unused"),LOG_DIR:path.join(out,"logs-unused"),APP_PORT:String(server.address().port),NEXT_TELEMETRY_DISABLED:"1"});
 const manifest=JSON.parse(await readFile(".next/required-server-files.json","utf8"));
 app=next({dev:false,dir:serverDir,conf:manifest.config,hostname:"127.0.0.1",port:server.address().port});await app.prepare();handler=app.getRequestHandler();
 const result=await verifyUserGuide((route,headers={})=>fetch(origin+route,{headers,redirect:"manual"}),out,{runtime:"native",secretSentinel:secret});
 assert.deepEqual(errors,[],"Native guide SSR must produce no captured server errors, including accidental DB access");
 await writeFile(path.join(out,"result.json"),JSON.stringify({...result,requests:trace.length,buildId:(await readFile(".next/BUILD_ID","utf8")).trim(),buildIdFileSha256:createHash("sha256").update(await readFile(".next/BUILD_ID")).digest("hex"),databaseConnected:false},null,2));
}catch(error){exitCode=1;previousError(error);await writeFile(path.join(out,"result.json"),JSON.stringify({complete:false,phase:error.blockedBy?"blocked":"failed",blockedBy:error.blockedBy,...error.partial,error:String(error),browserExecuted:false,limitations:"Partial HTTP/SSR/RSC only. Required real screenshot gate remains strict. Missing assets prevent completion; no browser or production access."},null,2));}
finally{
 console.error=previousError;await writeFile(path.join(out,"requests.json"),JSON.stringify(trace,null,2));await writeFile(path.join(out,"server-errors.json"),JSON.stringify(errors,null,2));
 server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));if(app)await app.close();
 const after=await buildSnapshot(roots),unchanged=JSON.stringify(before)===JSON.stringify(after);await writeFile(path.join(out,"build-provenance.json"),JSON.stringify({before,after,unchanged},null,2));if(!unchanged){previousError("Native bundle changed during guide HTTP QA");exitCode=1;}
}
process.exit(exitCode);
