/** Prior schema to revision archive, using only retained synthetic records. */
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,Log,LogLevel} from 'miniflare';
const mf=new Miniflare({cf:false,modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'revision-migration'},r2Buckets:{ATTACHMENTS:'revision-files'},log:new Log(LogLevel.ERROR)});
try {
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('ATTACHMENTS');
 const statements=async file=>(await readFile(`drizzle/${file}`,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
 for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')&&f<'0007').sort())for(const sql of await statements(file))await db.prepare(sql).run();
 await db.prepare("INSERT INTO users(id,email,name,role) VALUES(1,'legacy@example.test','Legacy','member')").run();
 await db.prepare("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Legacy','2026-01-01','2026-12-31')").run();
 await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(1,1,'Legacy','2026-01-01','2026-12-31')").run();
 await bucket.put('legacy/file.txt','original bytes');
 await db.prepare("INSERT INTO submissions(id,task_id,author_id,content,visibility,file_path,file_name,file_mime_type,file_size_bytes,created_at) VALUES(1,1,1,'Private surviving body','private','legacy/file.txt','file.txt','text/plain',14,'2001-01-01 00:00:00')").run();
 await db.prepare("INSERT INTO submission_attachments(id,submission_id,file_path,file_name,file_mime_type,file_size_bytes) VALUES(1,1,'legacy/file.txt','file.txt','text/plain',14)").run();
 await db.prepare("INSERT INTO comments(id,submission_id,author_id,content) VALUES(1,1,1,'Legacy discussion')").run();
 await db.batch((await statements('0007_submission_revisions.sql')).map(sql=>db.prepare(sql)));
 const root=await db.prepare('SELECT * FROM submissions WHERE id=1').first(),revision=await db.prepare('SELECT * FROM submission_revisions WHERE submission_id=1').first(),event=await db.prepare('SELECT * FROM submission_events WHERE submission_id=1').first();
 assert.equal(root.content,'Private surviving body');assert.equal(root.visibility,'private');assert.equal(root.author_id,1);assert.equal(root.created_at,'2001-01-01 00:00:00');assert.equal(root.current_revision,1);
 assert.equal(revision.content,root.content);assert.equal(revision.source,'legacy');assert.equal(revision.editor_id,null);assert.notEqual(revision.created_at,root.created_at);assert.equal(event.kind,'baseline');assert.equal(revision.file_path,'legacy/file.txt');
 assert.equal((await db.prepare('SELECT revision_number FROM comments WHERE id=1').first()).revision_number,null);assert.equal((await db.prepare('SELECT revision_number FROM submission_attachments WHERE id=1').first()).revision_number,1);
 assert.equal(await(await bucket.get('legacy/file.txt')).text(),'original bytes');
 console.log('PASS additive D1 revision migration: original body/visibility/identity/time/bytes preserved; labeled surviving snapshot, baseline event, null legacy comment revision, stable attachment IDs.');
}finally{await mf.dispose();}
