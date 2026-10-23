/** Redirect context contains validated query filters, never an arbitrary return URL. */
import assert from "node:assert/strict";
import {beforeEach,test} from "node:test";
import {mockModuleExports} from "./helpers/mock-module";
import {formDataFrom} from "./helpers/redirect";
import {parseTaskTeamFilter} from "../src/shared/lib/task-context";
let deny=false;
const replace=(specifier:string,exports:Record<string,unknown>)=>mockModuleExports(specifier.startsWith(".")?new URL(specifier,import.meta.url).href:specifier,exports);
replace("server-only",{});
replace("next/cache",{revalidatePath(){}});
replace("../src/entities/user/index.server.ts",{getAuthSession:async()=>({user:{email:"synthetic@example.test",role:"member",isSuperuser:false}}),getUserByEmail:async()=>({id:3,role:"member"}),getSignInPath:()=>"/api/auth/signin"});
const operation=async()=>{if(deny)throw new Error("Synthetic denial");};
replace("../src/entities/submission/index.server.ts",{requestSubmissionReview:operation,decideSubmissionReview:operation,cancelOrReopenSubmissionReview:operation});
const actions=await import("../src/features/submission-review/server/actions");
beforeEach(()=>{deny=false;});
async function redirect(action:(form:FormData)=>Promise<void>,teamId:string){
 try{await action(formDataFrom({taskId:11,submissionId:21,revisionNumber:2,expectedTaskVersion:3,operationToken:"synthetic-token",decision:"approved",reason:"Synthetic reason",teamId,returnTo:"/my-work?scope=mine"}));}
 catch(error){const digest=(error as {digest?:string}).digest;if(typeof digest!=="string"||!digest.startsWith("NEXT_REDIRECT;"))throw error;return new URL(digest.split(";")[2],"http://127.0.0.1");}
 throw new Error("Expected redirect");
}
test("team filter accepts positive safe ids and the explicit unassigned option",()=>{
 assert.equal(parseTaskTeamFilter("0012"),"12");assert.equal(parseTaskTeamFilter("unassigned"),"unassigned");
});
test("team filter rejects arbitrary paths, URLs, arrays and unsafe numbers",()=>{
 for(const input of [undefined,null,"",0,"0","-1","1.2","/admin","https://evil.invalid","9007199254740992",["1"]])assert.equal(parseTaskTeamFilter(input),undefined);
});
for(const name of ["requestSubmissionReviewAction","decideSubmissionReviewAction","cancelSubmissionReviewAction"] as const)test(`${name} preserves selected revision, team filter and personal return context`,async()=>{
 const url=await redirect(actions[name],"12");
 assert.equal(url.pathname,"/submissions/21");assert.equal(url.searchParams.get("revision"),"2");assert.equal(url.searchParams.get("teamId"),"12");assert.equal(url.searchParams.get("returnTo"),"/my-work?scope=mine&status=open&overdue=0&page=1");assert.equal(url.searchParams.get("review"),"saved");
});
test("a denied review preserves a safe filter while malicious filter text is discarded",async()=>{
 deny=true;
 const safe=await redirect(actions.requestSubmissionReviewAction,"unassigned");assert.equal(safe.searchParams.get("teamId"),"unassigned");assert.equal(safe.searchParams.get("review"),"error");
 const unsafe=await redirect(actions.requestSubmissionReviewAction,"https://evil.invalid");assert.equal(unsafe.searchParams.has("teamId"),false);assert.equal(unsafe.pathname,"/submissions/21");
});
