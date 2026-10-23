import "./helpers/bootstrap";
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyNativeSchema, type MigrationConnection } from "@/src/shared/server/database-admin/native-migrations.server";

const specification = `CREATE TABLE IF NOT EXISTS team_links (
  project_id BIGINT NOT NULL,
  team_id BIGINT NOT NULL,
  CONSTRAINT links_team_fk FOREIGN KEY (project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
type Key={columns:string;targetColumns:string;targetSchema?:string;targetTable?:string;deleteRule?:string};
function fixture(keys:Key[]):MigrationConnection {
  return {query:async sql=>{
    if(sql.includes('INFORMATION_SCHEMA.COLUMNS'))return ['project_id','team_id'].map(name=>({name,type:'bigint',nullable:'NO',defaultValue:null,extra:'',collation:null}));
    if(sql.includes('INFORMATION_SCHEMA.STATISTICS')||sql.includes('INFORMATION_SCHEMA.CHECK_CONSTRAINTS'))return [];
    if(sql.includes('INFORMATION_SCHEMA.KEY_COLUMN_USAGE'))return keys.map(key=>({targetSchema:'wbs_schema_test',targetTable:'activity_teams',deleteRule:'CASCADE',...key}));
    if(sql.includes('INFORMATION_SCHEMA.TABLES'))return [{engine:'InnoDB',collation:'utf8mb4_unicode_ci'}];
    assert.fail(`Unexpected fixture SQL: ${sql}`);
  }};
}
test('native verifier accepts the exact same-project composite foreign key', async()=>{
  await verifyNativeSchema(fixture([{columns:'project_id,team_id',targetColumns:'project_id,id'}]),'wbs_schema_test',[specification]);
});
test('native verifier rejects independent single-column keys in place of a composite guard',async()=>{
  await assert.rejects(verifyNativeSchema(fixture([{columns:'project_id',targetColumns:'project_id'},{columns:'team_id',targetColumns:'id'}]),'wbs_schema_test',[specification]),/incompatible foreign key/);
});
for(const key of [
  {columns:'project_id,team_id',targetColumns:'id,project_id'},
  {columns:'team_id,project_id',targetColumns:'project_id,id'},
  {columns:'project_id,team_id',targetColumns:'project_id,id',targetSchema:'other_schema'},
  {columns:'project_id,team_id',targetColumns:'project_id,id',deleteRule:'RESTRICT'},
])test(`native verifier rejects composite-key drift ${JSON.stringify(key)}`,async()=>{
  await assert.rejects(verifyNativeSchema(fixture([key]),'wbs_schema_test',[specification]),/incompatible foreign key/);
});
