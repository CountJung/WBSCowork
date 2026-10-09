/** Immutable project dependency graph, separate from the WBS hierarchy. */
import { nativeMigrationV1 } from './native-migration-v1';
const additions = [
 {table:'projects',name:'dependency_version',definition:'dependency_version INT NOT NULL DEFAULT 0'},
 {table:'projects',name:'dependency_token',definition:'dependency_token VARCHAR(191) NULL'},
] as const;
const newTables = [`CREATE TABLE IF NOT EXISTS task_dependencies (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT NOT NULL,
 task_id BIGINT NOT NULL,
 predecessor_id BIGINT NOT NULL,
 UNIQUE KEY task_dependency_unique (task_id,predecessor_id),
 KEY task_dependency_project_idx (project_id),
 CONSTRAINT task_dependency_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
 CONSTRAINT task_dependency_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
 CONSTRAINT task_dependency_predecessor_fk FOREIGN KEY (predecessor_id) REFERENCES tasks(id) ON DELETE CASCADE,
 CONSTRAINT task_dependency_self_check CHECK(task_id <> predecessor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`];
export const nativeMigrationV6 = {version:6,name:'task_dependencies',verifierVersion:1,additions,newTables,
 statements:[nativeMigrationV1.statements.find(sql=>sql.startsWith('CREATE TABLE IF NOT EXISTS projects ('))!.replace('(\n',`(\n${additions.map(c=>`    ${c.definition},`).join('\n')}\n`),...newTables] } as const;
