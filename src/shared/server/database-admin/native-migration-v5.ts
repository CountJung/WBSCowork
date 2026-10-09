/** Immutable additive selection of the exact submission version under review. */
import { nativeMigrationV1 } from './native-migration-v1';
const additions = [
  { table: 'tasks', name: 'review_submission_id', definition: 'review_submission_id BIGINT NULL' },
  { table: 'tasks', name: 'review_revision_number', definition: 'review_revision_number INT NULL' },
] as const;
export const nativeMigrationV5 = {
  version: 5, name: 'submission_review_selection', verifierVersion: 1, additions,
  statements: [nativeMigrationV1.statements.find(sql => sql.startsWith('CREATE TABLE IF NOT EXISTS tasks ('))!.replace('(\n', `(\n${additions.map(column => `    ${column.definition},`).join('\n')}\n`)],
} as const;
