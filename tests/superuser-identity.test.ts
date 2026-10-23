import "./helpers/bootstrap";
import assert from "node:assert/strict";
import {beforeEach,test} from "node:test";
import {setSession,clearSession} from "./helpers/bootstrap";
import {sessionFor,testActors} from "./helpers/session";
import {TEST_SUPERUSER_EMAIL} from "./helpers/test-env";
import {getEffectiveUserRole,isConfiguredSuperuser} from "../src/entities/user";
import {authOptions,getAuthSession} from "../src/entities/user/api/auth.server";
import {resolveUserRoleForSession} from "../src/entities/user/api/user-repository.server";
beforeEach(()=>clearSession());
test("configured identity always has effective admin regardless of stored/cached role",async()=>{
 for(const role of ["guest","member","admin"] as const)assert.equal(getEffectiveUserRole(role,TEST_SUPERUSER_EMAIL,TEST_SUPERUSER_EMAIL),"admin");
 assert.equal(await resolveUserRoleForSession(TEST_SUPERUSER_EMAIL),"admin");
 assert.equal(isConfiguredSuperuser(" SUPERUSER@EXAMPLE.TEST ",TEST_SUPERUSER_EMAIL),true);
 assert.equal(isConfiguredSuperuser("",TEST_SUPERUSER_EMAIL),false);assert.equal(isConfiguredSuperuser(TEST_SUPERUSER_EMAIL,""),false);
});
test("session projection rederives configured identity instead of trusting stale false flags",()=>{
 const session=sessionFor({...testActors.superuser,role:"guest",isSuperuser:false});
 const result=authOptions.callbacks.session({session,token:{email:TEST_SUPERUSER_EMAIL,role:"guest",isSuperuser:false}} as Parameters<typeof authOptions.callbacks.session>[0]);
 assert.equal(result.user.role,"admin");assert.equal(result.user.isSuperuser,true);
});
test("verified server-session normalization preserves SU without mutating database state",async()=>{
 setSession(sessionFor({...testActors.superuser,role:"guest",isSuperuser:false}));
 const result=await getAuthSession();assert.equal(result?.user.role,"admin");assert.equal(result?.user.isSuperuser,true);
});
test("normalization never creates a login or accepts an ordinary identity's claimed SU flag",async()=>{
 assert.equal(await getAuthSession(),null);
 setSession(sessionFor({...testActors.member1,isSuperuser:true}));
 assert.equal((await getAuthSession())?.user.isSuperuser,false);
 assert.equal(getEffectiveUserRole("guest",testActors.member1.email,TEST_SUPERUSER_EMAIL),"guest");
});

test("JWT refresh rederives configured SU role and flag from verified token identity",async()=>{
 const token=await authOptions.callbacks.jwt({token:{email:TEST_SUPERUSER_EMAIL,role:"guest",isSuperuser:false},trigger:"update",session:{role:"guest",isSuperuser:false}} as Parameters<typeof authOptions.callbacks.jwt>[0]);
 assert.equal(token.role,"admin");assert.equal(token.isSuperuser,true);assert.equal(token.email,TEST_SUPERUSER_EMAIL);
});
