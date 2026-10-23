/** Real ephemeral D1 statements against synthetic rows; auth boundary tests live separately. */
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { beforeEach,after,test } from "node:test";
import { applyTestEnv,TEST_SUPERUSER_EMAIL } from "./helpers/test-env";
import { mockModuleExports } from "./helpers/mock-module";
applyTestEnv();
const mf=new Miniflare({cf:false,modules:true,script:"export default {fetch(){return new Response('synthetic')}}",compatibilityDate:"2026-05-15",d1Databases:{DB:"global-admin-repository-test"}});
const db=await mf.getD1Database("DB");
await db.prepare("CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,name TEXT,role TEXT,google_id TEXT,avatar_url TEXT,last_login_at TEXT,last_synced_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
let revokeBeforeUpdate=false,updates=0;
mockModuleExports(new URL("../src/shared/server/database/index.server.ts",import.meta.url).href,{
 getDatabasePool:()=>({query:async(sql:string,args:unknown[]=[])=>{
   if(sql.startsWith("UPDATE")){
     updates++;
     if(revokeBeforeUpdate)await db.prepare("UPDATE users SET email='revoked@example.test' WHERE id=1").run();
     const result=await db.prepare(sql).bind(...args).run();return {affectedRows:result.meta.changes};
   }
   return (await db.prepare(sql).bind(...args).all()).results;
 }}),
});
mockModuleExports(new URL("../src/shared/server/hosted-runtime/index.server.ts",import.meta.url).href,{isHostedRuntime:()=>false});
mockModuleExports(new URL("../src/shared/server/database-admin/index.server.ts",import.meta.url).href,{getDatabaseAdminStatus:async()=>{throw new Error("Unexpected schema read");}});
await db.prepare("CREATE TABLE projects(id INTEGER PRIMARY KEY,access_mode TEXT)").run();
await db.prepare("CREATE TABLE project_members(project_id INTEGER,user_id INTEGER,active INTEGER)").run();
const {updateUserRole,listProjectUsersForViewer}=await import("../src/entities/user/api/user-repository.server");
const su={userId:1,email:TEST_SUPERUSER_EMAIL,isSuperuser:true};
beforeEach(async()=>{
 await db.prepare("DELETE FROM project_members").run();
 await db.prepare("DELETE FROM projects").run();
 await db.prepare("DELETE FROM users").run();
 for(const [id,email,role]of [[1,TEST_SUPERUSER_EMAIL,"admin"],[2,"admin@example.test","admin"],[3,"member@example.test","member"],[4,"departed@example.test","member"],[5,"guest@example.test","guest"]] as const)await db.prepare("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)").bind(id,email,`Synthetic${id}`,role).run();
 await db.prepare("INSERT INTO projects(id,access_mode) VALUES(1,'legacy_authenticated'),(2,'members_only')").run();
 await db.prepare("INSERT INTO project_members(project_id,user_id,active) VALUES(2,3,1),(2,4,0),(2,5,1)").run();
 revokeBeforeUpdate=false;updates=0;
});
after(()=>mf.dispose());
test("ordinary persisted admin has no global role update privilege",async()=>{
 await assert.rejects(()=>updateUserRole(3,"guest",{userId:2,email:"admin@example.test",isSuperuser:false}),/슈퍼관리자/);assert.equal(updates,0);
});
test("superuser flag and configured identity must agree with current database row",async()=>{
 await assert.rejects(()=>updateUserRole(3,"guest",{...su,userId:2}),/슈퍼관리자/);
 await assert.rejects(()=>updateUserRole(3,"guest",{...su,isSuperuser:false}),/슈퍼관리자/);assert.equal(updates,0);
});
test("configured superuser target cannot have its global role changed",async()=>{
 await assert.rejects(()=>updateUserRole(1,"guest",su),/변경할 수 없습니다/);assert.equal(updates,0);
});
test("current configured superuser updates a synthetic member and allows an unchanged repeat",async()=>{
 assert.equal((await updateUserRole(3,"guest",su)).role,"guest");
 assert.equal((await updateUserRole(3,"guest",su)).role,"guest");assert.equal(updates,2);
});
test("actor identity revocation immediately before UPDATE preserves target role atomically",async()=>{
 revokeBeforeUpdate=true;
 await assert.rejects(()=>updateUserRole(3,"guest",su),/슈퍼관리자/);
 assert.equal((await db.prepare("SELECT role FROM users WHERE id=3").first<{role:string}>())!.role,"member");
});

test("legacy selector keeps its authenticated directory but omits authentication metadata",async()=>{
 const rows=await listProjectUsersForViewer(1,{userId:3});
 assert.deepEqual(rows.map(row=>Number(row.id)),[1,2,3,4,5]);
 assert.deepEqual(Object.keys(rows[0]).sort(),["email","id","name","role"]);
 assert.deepEqual(await listProjectUsersForViewer(1,{}),[]);
});
test("restricted selector exposes active project roster only, including for a superuser",async()=>{
 for(const viewer of [{userId:3},{userId:5},{userId:1,isSuperuser:true}])assert.deepEqual((await listProjectUsersForViewer(2,viewer)).map(row=>Number(row.id)),[3,5]);
});
test("unassigned admin, inactive member, false SU and unknown project expose no directory",async()=>{
 for(const viewer of [{userId:2},{userId:4},{userId:2,isSuperuser:true},{}])assert.deepEqual(await listProjectUsersForViewer(2,viewer),[]);
 assert.deepEqual(await listProjectUsersForViewer(999,{userId:3}),[]);
});
test("revoked membership immediately removes restricted assignment selector access",async()=>{
 await db.prepare("UPDATE project_members SET active=0 WHERE project_id=2 AND user_id=3").run();
 assert.deepEqual(await listProjectUsersForViewer(2,{userId:3}),[]);
});
