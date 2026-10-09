/** Additive migration preservation on synthetic local D1; no row deletion. */
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,Log,LogLevel} from 'miniflare';
const mf=new Miniflare({cf:false,modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'task-migration-test'},log:new Log(LogLevel.ERROR)});
try {
  const db=await mf.getD1Database('DB');
  const files=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();
  const statements=async file=>(await readFile(`drizzle/${file}`,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
  for(const file of files.filter(f=>f<'0006'))for(const sql of await statements(file))await db.prepare(sql).run();
  await db.prepare("INSERT INTO users(id,email,name,role) VALUES(1,'legacy@task.test','Legacy','guest')").run();
  await db.prepare("INSERT INTO projects(id,name,start_date,end_date,goal) VALUES(1,'Legacy','2026-01-01','2026-12-31','Keep goal')").run();
  await db.prepare("INSERT INTO tasks(id,project_id,title,start_date,end_date,assignee_id,deliverable) VALUES(1,1,'Legacy card','2026-01-01','2026-12-31',1,'Keep output')").run();
  await db.batch((await statements('0006_task_execution.sql')).map(sql=>db.prepare(sql)));
  const row=await db.prepare('SELECT * FROM tasks WHERE id=1').first(),event=await db.prepare('SELECT * FROM task_events WHERE task_id=1').first();
  assert.equal(row.assignee_id,1);assert.equal(row.deliverable,'Keep output');assert.equal(row.status,'planned');assert.equal(row.version,1);assert.equal((await db.prepare('SELECT role FROM users WHERE id=1').first()).role,'guest');
  assert.equal(event.kind,'baseline');assert.equal(event.assignee_id,1);assert.equal(event.task_version,1);assert.match(event.note,/도입 시점/);
  const fk=(await db.prepare('PRAGMA foreign_key_list(tasks)').all()).results.find(f=>f.from==='reviewer_id');assert.equal(fk.on_delete,'SET NULL');
  console.log('PASS additive D1 task migration: original values/guest assignment preserved, planned default, explicit current-state baseline, reviewer SET NULL contract.');
}finally{await mf.dispose();}
