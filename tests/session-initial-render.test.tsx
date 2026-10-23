/** Unit SSR of the real provider; browser hydration is verified by the loopback QA harness. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {SessionProvider,useSession} from "next-auth/react";
import AppProviders from "../src/shared/ui/providers";
import {sessionFor,testActors} from "./helpers/session";
function AuthProbe(){
 const {data,status}=useSession();
 return <span data-status={status} data-identity={data?.user?.name??""}>{status==='authenticated'&&data?.user?'로그아웃':'Google 로그인'}</span>;
}
test("an omitted initial session repeatedly starts loading and explains the old login flash",()=>{
 const render=()=>renderToStaticMarkup(createElement(SessionProvider,null,createElement(AuthProbe)));
 const server=render(),repeated=render();assert.equal(server,repeated);assert.match(server,/data-status="loading"/);assert.match(server,/Google 로그인/);
});
test("the actual app provider starts authenticated SSR without a loading login placeholder",()=>{
 const session=sessionFor(testActors.superuser);
 const render=()=>renderToStaticMarkup(<AppProviders session={session}><AuthProbe/></AppProviders>);
 const server=render(),repeated=render();
 assert.match(server,/data-status="authenticated"/);assert.match(server,/로그아웃/);assert.doesNotMatch(server,/Google 로그인/);
 assert.match(repeated,/data-status="authenticated"/);assert.match(repeated,/로그아웃/);
});
test("an explicit anonymous snapshot starts unauthenticated rather than loading",()=>{
 const markup=renderToStaticMarkup(<AppProviders session={null}><AuthProbe/></AppProviders>);
 assert.match(markup,/data-status="unauthenticated"/);assert.match(markup,/Google 로그인/);
});

test("alternating explicit snapshots never inherit another server viewer's provider state",()=>{
 const render=(session:ReturnType<typeof sessionFor>|null)=>renderToStaticMarkup(<AppProviders session={session}><AuthProbe/></AppProviders>);
 const signed=render(sessionFor(testActors.superuser)),anonymous=render(null),member=render(sessionFor(testActors.member1));
 assert.match(signed,/data-identity="슈퍼관리자"/);
 assert.match(anonymous,/data-status="unauthenticated" data-identity=""/);
 assert.doesNotMatch(anonymous,/슈퍼관리자/);assert.match(member,/data-identity="멤버1"/);assert.doesNotMatch(member,/슈퍼관리자/);
});
