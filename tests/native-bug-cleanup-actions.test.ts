import "./helpers/bootstrap";
import {test} from "node:test";
import assert from "node:assert/strict";
import {mockModuleExports} from "./helpers/mock-module";
import type {DatabaseAdminStatus} from "../src/shared/server/database-admin/index.server";

let allowed=false,hosted=false,nativeCalls=0,hostedCalls=0,auditCalls=0;
let fault:""|"native"|"audit"|"status"="";
const status:DatabaseAdminStatus={host:"127.0.0.1",port:3307,user:"synthetic",databaseName:"synthetic_test",databaseExists:true,existingTableCount:1,managedTableCount:1,tables:[{name:"native_bug_file_cleanup_jobs",exists:true,missingColumns:[]}],nativeMigrations:{ledgerExists:true,appliedVersions:[13],pendingVersions:[]}};
mockModuleExports("@/src/entities/user/index.server",{requireSuperuserSession:async()=>allowed?{user:{email:"synthetic-superuser@example.test",isSuperuser:true}}:null,upsertUser:async()=>{throw new Error("not used");}});
mockModuleExports("@/src/shared/server/hosted-runtime/index.server",{isHostedRuntime:()=>hosted});
mockModuleExports("@/src/shared/server/native-bug-cleanup/index.server",{retryNativeBugFileCleanup:async(limit:number)=>{nativeCalls++;assert.equal(limit,100);if(fault==="native")throw new Error("sensitive driver SQL and private file body must not escape");return {quarantined:2,protectedFiles:3,remaining:4,failed:1};}});
mockModuleExports("@/src/shared/server/object-cleanup/index.server",{retryObjectCleanup:async()=>{hostedCalls++;return {removed:5,remaining:0,failed:0};}});
mockModuleExports("@/src/shared/server/database-admin/index.server",{getDatabaseAdminStatus:async()=>{if(fault==="status")throw new Error("sensitive status error");return status;},initializeDatabaseSchema:async()=>{throw new Error("not used");}});
mockModuleExports("@/src/shared/server/logging/index.server",{logUserAction:async()=>{auditCalls++;if(fault==="audit")throw new Error("sensitive audit error");},logUserActionFailure:async()=>{throw new Error("not used");}});
const {retryStorageCleanupAction}=await import("../src/features/database-manage/server/actions");
const previous=()=>({success:null,message:"",status});
function reset(){allowed=false;hosted=false;nativeCalls=0;hostedCalls=0;auditCalls=0;fault="";}
test("missing current SU authorization rejects both cleanup modes before any storage call",async()=>{
  for(const mode of [false,true]){reset();hosted=mode;const result=await retryStorageCleanupAction(previous());assert.equal(result.success,false);assert.match(result.message,/슈퍼유저만/);assert.equal(nativeCalls+hostedCalls+auditCalls,0);}
});
test("authorized Native cleanup uses server runtime and reports reversible counts, never hosted deletion",async()=>{
  reset();allowed=true;
  const forged=previous();forged.status={...status,managedMigrations:true};
  const result=await retryStorageCleanupAction(forged);
  assert.equal(nativeCalls,1);assert.equal(hostedCalls,0);assert.equal(auditCalls,1);assert.equal(result.success,false);
  assert.match(result.message,/2개 격리, 3개 참조 보호, 4개 대기, 1개 실패/);assert.match(result.message,/영구 삭제하지/);
});
test("Native cleanup failure returns safe uncertain-outcome guidance without driver/file details",async()=>{
  reset();allowed=true;fault="native";
  const result=await retryStorageCleanupAction(previous());
  assert.equal(result.success,false);assert.match(result.message,/이미 이동한 파일도 보존/);assert.doesNotMatch(result.message,/sensitive|SQL|private file body/);assert.equal(auditCalls,0);assert.equal(hostedCalls,0);
});
test("post-cleanup audit/status failure preserves completed counts and distinguishes follow-up failure",async()=>{
  for(const mode of ["audit","status"] as const){reset();allowed=true;fault=mode;const result=await retryStorageCleanupAction(previous());assert.equal(result.success,false);assert.match(result.message,/2개 격리/);assert.match(result.message,/처리 후 감사 또는 상태 갱신/);assert.doesNotMatch(result.message,/sensitive/);assert.equal(nativeCalls,1);assert.equal(hostedCalls,0);}
});
test("hosted cleanup retains its existing implementation and does not invoke native quarantine",async()=>{
  reset();allowed=true;hosted=true;const result=await retryStorageCleanupAction(previous());
  assert.equal(result.success,true);assert.equal(hostedCalls,1);assert.equal(nativeCalls,0);assert.match(result.message,/5개 정리 완료/);
});
