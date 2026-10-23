/** Bytes and identities exist only in fresh loopback QA databases/stores. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';

function pngChunk(type,bytes){
  const kind=Buffer.from(type),body=Buffer.concat([kind,bytes]);let crc=0xffffffff;
  for(const byte of body){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  const length=Buffer.alloc(4),sum=Buffer.alloc(4);length.writeUInt32BE(bytes.length);sum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([length,body,sum]);
}
function png(){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(2,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(Buffer.from([0,20,80,120,255,20,80,120,255,0,20,80,120,255,20,80,120,255]))),pngChunk('IEND',Buffer.alloc(0))]);}

const rasterFixtures={"jpeg":"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDgqKKK9s8I/9k=","gif":"R0lGODdhAgACAIEAABRQeAAAAAAAAAAAACwAAAAAAgACAAAIBgABCAQQEAA7","webp":"UklGRjgAAABXRUJQVlA4ICwAAADQAQCdASoCAAIAAUAmJaACdLoB+AADsAD+9hNf/gfl04Y8P/izkYjsvAAAAA==","avif":"AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAKQAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAgAAAAIAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAMW1kYXQSAAoIGAA2iAhoNCAyGxTHh4ZlAgggnlAAAABIWtlc1jBuBm4UogAzqA=="};

export function attachmentPreviewFiles(){
  const text='PREVIEW_UTF8_한글: 식사 준비와 안전 점검\r\n둘째 줄 · <script>globalThis.__PREVIEW_EXECUTED__=true</script>\n끝';
  const definitions=[
    [4001,3001,1,'utf8','한글 미리보기.txt','text/plain',Buffer.from(text)],
    [4002,3001,1,'bom','UTF8-BOM.txt','text/plain',Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('BOM_한글_정상')])],
    [4003,3001,1,'longline','긴한국어파일명_'.repeat(10)+'.log','text/plain',Buffer.from('LONG_LINE_START|'+ '긴줄'.repeat(2048)+'|LONG_LINE_END')],
    [4004,3001,1,'empty','empty.txt','text/plain',Buffer.alloc(0)],
    [4005,3001,1,'large','large.txt','text/plain',Buffer.from('LARGE_PREVIEW_START|'+ '한글미리보기 '.repeat(120000)+'|LARGE_PREVIEW_END')],
    [4006,3002,1,'invalid-encoding','invalid-encoding.txt','text/plain',Buffer.from([0xff,0xfe,0x61,0,0x62,0])],
    [4007,3002,1,'binary','binary.txt','text/plain',Buffer.from([0x42,0,1,2,3,0x59,0])],
    [4008,3002,1,'html','active.html','text/html',Buffer.from('<!doctype html><script>globalThis.__PREVIEW_EXECUTED__=true;fetch("https://preview-execution.example.test/")</script>')],
    [4009,3002,1,'svg','active.svg','image/svg+xml',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="globalThis.__PREVIEW_EXECUTED__=true"><script>fetch("https://preview-execution.example.test/")</script></svg>')],
    [4010,3002,1,'mime-disguised','disguised.png','image/png',Buffer.from('<script>globalThis.__PREVIEW_EXECUTED__=true</script>')],
    [4011,3002,1,'unsupported','unsupported.zip','application/zip',Buffer.from([0x50,0x4b,3,4,0,0,0,0])],
    [4012,3003,1,'image','safe-image.png','image/png',png()],
    [4013,3003,1,'broken-image','broken-image.png','image/png',png().subarray(0,24)],
    [4014,3003,1,'plain-octet','plain-octet.txt','application/octet-stream',Buffer.from('OCTET_UTF8_한글')],
    [4015,3003,1,'pdf','unsupported.pdf','application/pdf',Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF')],
    [4016,3003,1,'oversized-image','oversized-image.png','image/png',Buffer.concat([png(),Buffer.alloc(8*1024*1024)])],
    [4017,3002,1,'markdown','raw-markdown.md','text/markdown',Buffer.from('# RAW_MARKDOWN_한글\n[실행금지](javascript:globalThis.__PREVIEW_EXECUTED__=true)\n<script>globalThis.__PREVIEW_EXECUTED__=true</script>')],
    [4018,3002,1,'code','raw-code.js','text/javascript',Buffer.from('/* RAW_CODE_한글 */ globalThis.__PREVIEW_EXECUTED__=true; fetch("https://preview-execution.example.test/");')],
    [4019,3003,1,'image-mime-mismatch','mismatched.jpg','image/jpeg',png()],
    [4020,3002,1,'invalid-utf8','invalid-utf8.txt','text/plain',Buffer.from([0xc3,0x28])],
    [4051,3003,1,'image-jpeg','safe-image.jpg','image/jpeg',Buffer.from(rasterFixtures.jpeg,'base64')],
    [4052,3003,1,'image-gif','safe-image.gif','image/gif',Buffer.from(rasterFixtures.gif,'base64')],
    [4053,3003,1,'image-webp','safe-image.webp','image/webp',Buffer.from(rasterFixtures.webp,'base64')],
    [4054,3003,1,'image-avif','safe-image.avif','image/avif',Buffer.from(rasterFixtures.avif,'base64')],
    [4021,3021,1,'private','private.txt','text/plain',Buffer.from('PRIVATE_PREVIEW_AUTHOR_ONLY')],
    [4031,3031,1,'old-private','old-private.txt','text/plain',Buffer.from('OLD_PRIVATE_SNAPSHOT_ONLY')],
    [4032,3031,2,'current-public','current-public.txt','text/plain',Buffer.from('CURRENT_PUBLIC_SNAPSHOT')],
    [4041,3041,1,'other-project','other-project.txt','text/plain',Buffer.from('OTHER_PROJECT_PREVIEW')],
  ];
  return definitions.map(([id,submissionId,revision,kind,name,mime,bytes])=>({id,submissionId,revision,kind,name,mime,bytes,key:`synthetic/attachment-preview/${id}.bin`,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
}

export async function seedAttachmentPreview(db,{encode,secret,putFile}){
  const tokens={};
  for(const [id,name,role] of [[1,'미리보기 합성 SU','guest'],[2,'미리보기 작성자','member'],[3,'미리보기 다른 참여자','member'],[4,'다른 프로젝트 참여자','member'],[5,'합성 읽기 참여자','guest'],[6,'합성 지정 관리자','admin'],[7,'합성 미지정 관리자','admin']]){
    const email=`attachment-preview-${id}@example.test`;
    await db.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').bind(id,email,name,role).run();
    tokens[id]=await encode({secret,token:{email,name,role,isSuperuser:false},maxAge:3600});
  }
  for(const [id,name] of [[1001,'미리보기 합성 프로젝트 A'],[1002,'미리보기 합성 프로젝트 B']])await db.prepare("INSERT INTO projects(id,name,access_mode,start_date,end_date) VALUES(?,?,'members_only','2026-01-01','2027-12-31')").bind(id,name).run();
  for(const id of [2,3,5,6])await db.prepare('INSERT INTO project_members(project_id,user_id) VALUES(1001,?)').bind(id).run();
  await db.prepare('INSERT INTO project_members(project_id,user_id) VALUES(1002,4)').run();
  for(const [id,project] of [[2001,1001],[2002,1002]])await db.prepare("INSERT INTO tasks(id,project_id,title,description,assignee_id,start_date,end_date) VALUES(?,?,?,'미리보기 합성 업무',?,'2026-01-01','2027-12-31')").bind(id,project,`합성 미리보기 업무 ${id}`,null).run();
  await db.prepare("INSERT INTO tasks(id,project_id,title,description,assignee_id,start_date,end_date) VALUES(2003,1001,'합성 기존 SU 배정 보존','신규 배정이 아닌 기존 자료 baseline',1,'2026-01-01','2027-12-31')").run();
  for(const [id,task,author,visibility,revision] of [[3001,2001,2,'public',1],[3002,2001,2,'public',1],[3003,2001,2,'public',1],[3021,2001,2,'private',1],[3031,2001,2,'public',2],[3041,2002,4,'public',1]]){
    await db.prepare('INSERT INTO submissions(id,task_id,author_id,content,visibility,current_revision) VALUES(?,?,?,?,?,?)').bind(id,task,author,`합성 미리보기 제출 ${id}`,visibility,revision).run();
    for(let rev=1;rev<=revision;rev++)await db.prepare('INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility) VALUES(?,?,?,?,?)').bind(id,rev,author,`합성 미리보기 제출 ${id} v${rev}`,id===3031&&rev===1?'private':visibility).run();
  }
  const files=attachmentPreviewFiles();
  for(const file of files){await putFile(file.key,file.bytes);await db.prepare('INSERT INTO submission_attachments(id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes) VALUES(?,?,?,?,?,?,?)').bind(file.id,file.submissionId,file.revision,file.key,file.name,file.mime,file.size).run();}
  const legacy=[{revision:1,key:'synthetic/attachment-preview/legacy-v1.txt',bytes:Buffer.from('LEGACY_PRIVATE_SNAPSHOT'),visibility:'private'},{revision:2,key:'synthetic/attachment-preview/legacy-v2.txt',bytes:Buffer.from('LEGACY_CURRENT_UTF8_한글'),visibility:'public'}];
  await db.prepare("INSERT INTO submissions(id,task_id,author_id,content,visibility,current_revision,file_path,file_name,file_mime_type,file_size_bytes) VALUES(3051,2001,2,'합성 legacy 제출','public',2,?,'legacy-v2.txt','text/plain',?)").bind(legacy[1].key,legacy[1].bytes.length).run();
  for(const file of legacy){await putFile(file.key,file.bytes);await db.prepare("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,file_path,file_name,file_mime_type,file_size_bytes) VALUES(3051,?,2,?,?,?,?,'text/plain',?)").bind(file.revision,`합성 legacy v${file.revision}`,file.visibility,file.key,`legacy-v${file.revision}.txt`,file.bytes.length).run();}
  assert.equal(files.length,28);
  return {tokens,files,legacy,text:files.find(file=>file.kind==='utf8').bytes.toString('utf8'),clientFiles:files.map(file=>Object.fromEntries(Object.entries(file).filter(([key])=>key!=='bytes')))};
}

export async function verifyAttachmentPreviewFixture(fixture,{query,readFile}){
  const rows=await query('SELECT id,submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes FROM submission_attachments ORDER BY id');
  assert.equal(rows.length,fixture.files.length);
  for(const file of fixture.files){const row=rows.find(row=>Number(row.id)===file.id);assert(row);assert.equal(Number(row.submission_id),file.submissionId);assert.equal(Number(row.revision_number),file.revision);assert.equal(row.file_path,file.key);assert.equal(row.file_name,file.name);assert.equal(row.file_mime_type,file.mime);assert.equal(Number(row.file_size_bytes),file.size);assert.equal(createHash('sha256').update(await readFile(file.key)).digest('hex'),file.sha256);}
  for(const file of fixture.legacy)assert.deepEqual(await readFile(file.key),file.bytes);
  const counts={};for(const table of ['projects','tasks','submissions','submission_revisions','submission_attachments','users'])counts[table]=Number((await query(`SELECT COUNT(*) count FROM ${table}`))[0].count);
  assert.deepEqual(counts,{projects:2,tasks:3,submissions:7,submission_revisions:9,submission_attachments:28,users:7});
  assert.equal(Number((await query('SELECT assignee_id FROM tasks WHERE id=2003'))[0].assignee_id),1);
  assert.equal((await query('SELECT assignee_id FROM tasks WHERE id=2001'))[0].assignee_id,null);
  const su=await query('SELECT role FROM users WHERE id=1');assert.equal(su[0].role,'guest');
  assert.equal(Number((await query('SELECT COUNT(*) count FROM project_members WHERE user_id=1'))[0].count),0);
  const removed=await query('SELECT active FROM project_members WHERE project_id=1001 AND user_id=2');assert.equal(Number(removed[0].active),0);
  const other=await query('SELECT active FROM project_members WHERE project_id=1002 AND user_id=4');assert.equal(Number(other[0].active),1);
  return {complete:true,counts,preservedFiles:fixture.files.length+fixture.legacy.length,authorMembershipRevoked:true,otherProjectMembershipPreserved:true,environmentSuDatabaseRolePreserved:true,environmentSuMemberships:0,legacySuAssignmentPreserved:true};
}
