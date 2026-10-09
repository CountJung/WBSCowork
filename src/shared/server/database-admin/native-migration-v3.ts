/** Released specification: append a migration instead of changing a published version. */
import { nativeMigrationV2 } from "./native-migration-v2";
const additions=[
  {table:'tasks',name:'creation_token',definition:'creation_token VARCHAR(160) NULL UNIQUE'},
  {table:'tasks',name:'status',definition:"status VARCHAR(32) NOT NULL DEFAULT 'planned'"},
  {table:'tasks',name:'version',definition:'version INT NOT NULL DEFAULT 1'},
  {table:'tasks',name:'workflow_note',definition:"workflow_note TEXT NOT NULL DEFAULT ''"},
  {table:'tasks',name:'last_operation_token',definition:'last_operation_token VARCHAR(160) NULL'},
  {table:'tasks',name:'reviewer_id',definition:'reviewer_id BIGINT NULL'},
] as const;
const newTables=[`CREATE TABLE IF NOT EXISTS task_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    actor_id BIGINT NULL,
    operation_token VARCHAR(160) NOT NULL UNIQUE,
    request_fingerprint CHAR(64) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    assignee_id BIGINT NULL,
    reviewer_id BIGINT NULL,
    note TEXT NOT NULL DEFAULT '',
    task_version INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY task_events_task_idx (task_id,id),
    UNIQUE KEY task_events_version_unique (task_id,task_version),
    CONSTRAINT task_events_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT task_events_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT task_events_assignee_fk FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT task_events_reviewer_fk FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`];
const foreignKeys=[{table:'tasks',column:'reviewer_id',definition:'CONSTRAINT tasks_reviewer_fk FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL'}];
const baselineSql="INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version) SELECT id,NULL,CONCAT('baseline:task:',id),'0000000000000000000000000000000000000000000000000000000000000000','baseline',status,assignee_id,reviewer_id,'업무 이력 도입 시점의 상태',version FROM tasks WHERE NOT EXISTS(SELECT 1 FROM task_events e WHERE e.task_id=tasks.id AND e.task_version=tasks.version)";
export const nativeMigrationV3={baselineSql,version:3,name:'task_execution',verifierVersion:1,additions,newTables,foreignKeys,statements:[
  nativeMigrationV2.statements.find(sql=>sql.startsWith('CREATE TABLE IF NOT EXISTS tasks ('))!.replace('(\n',`(\n${additions.map(c=>`    ${c.definition},`).join('\n')}\n`).replace('\n  ) ENGINE',`,\n    ${foreignKeys[0].definition}\n  ) ENGINE`),...newTables,
]} as const;
