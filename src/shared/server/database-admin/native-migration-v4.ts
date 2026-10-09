/** Immutable after release: submission projection + revision archive, additive only. */
import { nativeMigrationV1 } from './native-migration-v1';
const additions=[
 {table:'submissions',name:'creation_token',definition:'creation_token VARCHAR(160) NULL UNIQUE'},
 {table:'submissions',name:'current_revision',definition:'current_revision INT NOT NULL DEFAULT 1'},
 {table:'submissions',name:'version',definition:'version INT NOT NULL DEFAULT 1'},
 {table:'submissions',name:'last_operation_token',definition:'last_operation_token VARCHAR(160) NULL'},
 {table:'submissions',name:'material_url',definition:"material_url VARCHAR(2048) NOT NULL DEFAULT ''"},
 {table:'submission_attachments',name:'revision_number',definition:'revision_number INT NOT NULL DEFAULT 1'},
 {table:'comments',name:'revision_number',definition:'revision_number INT NULL'},
] as const;
const newTables=[`CREATE TABLE IF NOT EXISTS submission_revisions (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 submission_id BIGINT NOT NULL,
 revision_number INT NOT NULL,
 editor_id BIGINT NULL,
 content TEXT NOT NULL,
 visibility ENUM('public','private') NOT NULL,
 material_url VARCHAR(2048) NOT NULL DEFAULT '',
 change_summary TEXT NOT NULL DEFAULT '',
 file_path VARCHAR(500) NULL,
 file_name VARCHAR(255) NULL,
 file_mime_type VARCHAR(255) NULL,
 file_size_bytes BIGINT NULL,
 source VARCHAR(16) NOT NULL DEFAULT 'live',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY submission_revision_unique (submission_id,revision_number),
 KEY submission_revisions_submission_idx (submission_id,id),
 CONSTRAINT submission_revisions_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
 CONSTRAINT submission_revisions_editor_fk FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE SET NULL
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS submission_events (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 submission_id BIGINT NOT NULL,
 revision_number INT NOT NULL,
 actor_id BIGINT NULL,
 operation_token VARCHAR(160) NOT NULL UNIQUE,
 request_fingerprint CHAR(64) NOT NULL,
 kind VARCHAR(32) NOT NULL,
 body TEXT NOT NULL DEFAULT '',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY submission_events_submission_idx (submission_id,id),
 CONSTRAINT submission_events_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
 CONSTRAINT submission_events_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`];
const baselineSql=[
 "INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,material_url,change_summary,file_path,file_name,file_mime_type,file_size_bytes,source) SELECT id,current_revision,NULL,content,visibility,material_url,'이력 도입 시점의 기존 자료',file_path,file_name,file_mime_type,file_size_bytes,'legacy' FROM submissions WHERE NOT EXISTS(SELECT 1 FROM submission_revisions r WHERE r.submission_id=submissions.id AND r.revision_number=submissions.current_revision)",
 "INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind,body) SELECT id,current_revision,NULL,CONCAT('baseline:submission:',id),'0000000000000000000000000000000000000000000000000000000000000000','baseline','이력 도입 시점의 기존 자료' FROM submissions WHERE NOT EXISTS(SELECT 1 FROM submission_events e WHERE e.operation_token=CONCAT('baseline:submission:',submissions.id))",
];
export const nativeMigrationV4={version:4,name:'submission_revisions',verifierVersion:1,additions,newTables,baselineSql,statements:[
 ...['submissions','submission_attachments','comments'].map(table=>nativeMigrationV1.statements.find(sql=>sql.startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`))!.replace('(\n',`(\n${additions.filter(c=>c.table===table).map(c=>`    ${c.definition},`).join('\n')}\n`)),...newTables,
]} as const;
