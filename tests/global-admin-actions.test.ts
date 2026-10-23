/** Synthetic identities only: global operations must not inherit project-admin rights. */
import assert from "node:assert/strict";
import { beforeEach,test } from "node:test";
import { applyTestEnv,TEST_SUPERUSER_EMAIL } from "./helpers/test-env";
import { mockModuleExports } from "./helpers/mock-module";
import { formDataFrom,runAction } from "./helpers/redirect";
applyTestEnv();
let email="admin@example.test",role="admin",sessionSuperuser=false,persisted=true;
let updates=0,overviewReads=0,screenshotScope:boolean|undefined;
const replace=(specifier:string,exports:Record<string,unknown>)=>mockModuleExports(specifier.startsWith(".")?new URL(specifier,import.meta.url).href:specifier,exports);
replace("server-only",{});
replace("next/cache",{revalidatePath(){}});
replace("../src/entities/user/index.server.ts",{
 getAuthSession:async()=>({user:{email,role,isSuperuser:sessionSuperuser}}),
 getSignInPath:()=>"/api/auth/signin",
 getUserByEmail:async()=>persisted?{id:1,email,role,name:"Synthetic actor"}:null,
 isSuperuserEmail:(value:string)=>value===TEST_SUPERUSER_EMAIL,
 listAllUsers:async()=>[],
 updateUserRole:async(_id:number,_role:string,actor:{userId:number;email:string;isSuperuser:boolean})=>{assert.deepEqual(actor,{userId:1,email:TEST_SUPERUSER_EMAIL,isSuperuser:true});updates++;return{id:2,name:"Synthetic target",email:"target@example.test"};},
});
replace("../src/shared/server/logging/index.server.ts",{logUserAction:async()=>{},logUserActionFailure:async()=>{}});
replace("../src/features/admin-overview/index.server.ts",{getAdminOverview:async()=>{overviewReads++;return null;}});
replace("../src/shared/server/database-admin/index.server.ts",{getDatabaseAdminStatus:async()=>({databaseExists:true,tables:[{name:"users",exists:true,missingColumns:[]}]})});
replace("../src/entities/bug-report/index.server.ts",{
 getBugReport:async()=>null,listBugReports:async()=>({reports:[],total:0}),listBugEvents:async()=>[],getBugPurgeSnapshot:async()=>null,listBugScreenshots:async()=>[],
 getBugScreenshot:async(_id:number,viewer:{canReview:boolean})=>{screenshotScope=viewer.canReview;return null;},readBugScreenshot:async()=>{throw new Error("Unexpected file read");},
});
const {updateUserRoleAction}=await import("../src/features/user-role-change/server/actions");
const {requireBugViewer}=await import("../src/features/bug-report-manage/server/bug-report.server");
const {GET}=await import("../app/api/bug-screenshots/[screenshotId]/route");
const {default:AdminPage}=await import("../app/admin/page");
const {default:UsersPage}=await import("../app/admin/users/page");
beforeEach(()=>{email="admin@example.test";role="admin";sessionSuperuser=false;persisted=true;updates=0;overviewReads=0;screenshotScope=undefined;});
const form=()=>formDataFrom({userId:2,role:"member"});
for(const actor of ["admin","member","guest"])test(`${actor} cannot change global user roles or review other reporters`,async()=>{
 role=actor;
 const result=await runAction(()=>updateUserRoleAction(form()));
 assert.equal(result.status,"error");assert.equal(updates,0);
 const viewer=await requireBugViewer("/bugs");assert.equal(viewer.canReview,false);assert.equal(viewer.canPurge,false);assert.equal(viewer.userId,1);
 await assert.rejects(()=>requireBugViewer("/admin/bugs",true),/NEXT_HTTP_ERROR_FALLBACK;404/);
 await GET(new Request("http://127.0.0.1/api/bug-screenshots/10"),{params:Promise.resolve({screenshotId:"10"})});assert.equal(screenshotScope,false);
});
test("a forged superuser session flag cannot elevate an ordinary persisted admin",async()=>{
 sessionSuperuser=true;
 assert.equal((await runAction(()=>updateUserRoleAction(form()))).status,"error");assert.equal(updates,0);
 assert.equal((await requireBugViewer("/bugs")).canReview,false);
 assert.equal((await runAction(()=>UsersPage({searchParams:Promise.resolve({})}))).path,"/");
});
test("an absent persisted identity fails closed even with a superuser flag",async()=>{
 email=TEST_SUPERUSER_EMAIL;sessionSuperuser=true;persisted=false;
 assert.equal((await runAction(()=>updateUserRoleAction(form()))).status,"error");assert.equal(updates,0);
 await assert.rejects(()=>requireBugViewer("/bugs"),/NEXT_HTTP_ERROR_FALLBACK;404/);
 assert.equal((await runAction(()=>AdminPage())).path,"/");assert.equal(overviewReads,0);
});
test("ordinary admin overview redirects to project management without reading global overview",async()=>{
 assert.equal((await runAction(()=>AdminPage())).path,"/admin/projects");assert.equal(overviewReads,0);
 assert.equal((await runAction(()=>UsersPage({searchParams:Promise.resolve({})}))).path,"/");
});
test("current configured superuser retains global roles, overview, bug review and screenshot scope",async()=>{
 email=TEST_SUPERUSER_EMAIL;sessionSuperuser=true;
 assert.equal((await runAction(()=>updateUserRoleAction(form()))).status,"success");assert.equal(updates,1);
 const viewer=await requireBugViewer("/admin/bugs",true);assert.equal(viewer.canReview,true);assert.equal(viewer.canPurge,true);
 await GET(new Request("http://127.0.0.1/api/bug-screenshots/10"),{params:Promise.resolve({screenshotId:"10"})});assert.equal(screenshotScope,true);
 assert.ok(await AdminPage());assert.equal(overviewReads,1);assert.ok(await UsersPage({searchParams:Promise.resolve({})}));
});
