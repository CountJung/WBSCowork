import "./helpers/bootstrap";
import {test} from "node:test";
import assert from "node:assert/strict";
import {migrationChecksum} from "../src/shared/server/database-admin/native-migrations.server";
import {nativeMigrationV13} from "../src/shared/server/database-admin/native-migration-v13";
import {stageNativeBugFile,queueNativeBugFileCleanup,quarantineNativeBugFile,restoreNativeBugFile,retryNativeBugFileCleanup} from "../src/shared/server/native-bug-cleanup/index.server";
import {runWithHostedBindings} from "../src/shared/server/hosted-runtime/index.server";

test("native v13 immutable schema and both hash/size staging guards remain pinned",()=>{
  assert.equal(migrationChecksum(nativeMigrationV13),"65eb372ff9b7240fa98d95b79ff941ab6046367753427c2f9962122afc866d30");
  assert.equal(nativeMigrationV13.triggers.length,2);
  assert.ok(nativeMigrationV13.triggers.every(t=>t.body.includes("FOR UPDATE")&&t.body.includes("content_hash=NEW.content_hash")&&t.body.includes("file_size_bytes=NEW.file_size_bytes")));
  assert.ok(nativeMigrationV13.statements.every(sql=>!/(?:DELETE FROM|DROP TABLE|TRUNCATE|ON DELETE CASCADE)/i.test(sql)));
});
test("native quarantine accepts only bug keys and rejects submission/path escapes before DB access",async()=>{
  for(const key of ["submissions/7/1/keep.txt","native-bug-quarantine/keep.file","../bugs/1/a.png","bugs/1/../a.png","bugs/0/a.png","bugs/1/dir/a.png","bugs/1/a\u0000.png"]){
    await assert.rejects(queueNativeBugFileCleanup(key));
    await assert.rejects(quarantineNativeBugFile(key));
    await assert.rejects(restoreNativeBugFile(key));
  }
});
test("invalid staging size/hash and retry bounds fail before opening a database connection",async()=>{
  for(const [size,hash] of [[0,"a".repeat(64)],[2097153,"a".repeat(64)],[1,"not-a-hash"]] as const)await assert.rejects(stageNativeBugFile("bugs/1/a.png",size,hash));
  for(const limit of [0,101,1.5])await assert.rejects(retryNativeBugFileCleanup(limit));
});
test("hosted mode cannot invoke the native quarantine/recovery APIs",async()=>{
  await runWithHostedBindings({},async()=>{
    await assert.rejects(stageNativeBugFile("bugs/1/a.png",1,"a".repeat(64)));
    await assert.rejects(queueNativeBugFileCleanup("bugs/1/a.png"));
    await assert.rejects(quarantineNativeBugFile("bugs/1/a.png"));
    await assert.rejects(restoreNativeBugFile("bugs/1/a.png"));
    await assert.rejects(retryNativeBugFileCleanup());
  });
});
