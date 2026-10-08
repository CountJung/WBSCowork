/** Static build regression for the patched server-action decoder; no attack requests. */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
async function files(dir) {
  const all=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const name=path.join(dir,entry.name);
    if(entry.isDirectory())all.push(...await files(name));
    else if(entry.name.endsWith('.js'))all.push(name);
  }
  return all;
}
for(const name of ['react','react-dom','react-server-dom-webpack']) {
  const metadata=JSON.parse(await readFile(`node_modules/${name}/package.json`,'utf8'));
  assert.equal(metadata.version,'19.2.8',`${name}: keep the reviewed security patch trio aligned`);
}
let matches=0;
for(const file of await files('dist/server')) {
  const source=await readFile(file,'utf8');
  const decoder=source.match(/\.decodeAction=function\([^)]*\)\{([\s\S]*?)\},\w+\.decodeFormState=/)?.[1];
  if(!decoder)continue;
  matches++;
  assert.match(decoder,/new FormData,\w+=null/,'select one action key, rather than accumulating action work');
  assert.match(decoder,/===null\)return null;/,'one post-traversal selected-key guard');
  assert.ok(decoder.indexOf('===null)return null;')>decoder.indexOf('.forEach('),'decode only after traversing form fields');
  assert.ok(decoder.includes('Cannot handle action key. This is a bug in React.'),'19.2.8 selected-action implementation');
  assert.ok(!decoder.includes('new Set')&&!decoder.includes('seenActions'),'legacy action accumulation is absent');
  console.log(`PASS patched built decoder: ${file}`);
}
assert.equal(matches,1,'exactly one reviewed production decodeAction implementation is bundled');
console.log('RSC build fingerprint passed. This is a static patch check, not a DoS/exploit test.');
