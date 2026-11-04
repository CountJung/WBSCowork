import { createHash, randomUUID } from "node:crypto";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { projectPortalAccessGuard, projectPortalManagementGuard, type ProjectViewer } from "@/src/shared/server/project-portal-scope/index.server";
import { normalizePollInput, ProjectVoteError, voteId, type CreatePollInput, type PollList, type ProjectPoll } from "../model/vote";

type Row = Record<string, unknown>;
async function query(sql: string, params: readonly unknown[] = []): Promise<Row[]> {
  try { return await getDatabasePool().query(sql, params) as Row[]; } catch { throw new ProjectVoteError("UNAVAILABLE"); }
}
/** Time is evaluated by the DB at statement execution, not from a browser or a queued request. */
const clock = () => isHostedRuntime() ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : "DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%fZ')";
// MariaDB %f has six digits, while timestamps use three. LEFT preserves canonical lexicographic ordering.
const nowSql = () => isHostedRuntime() ? clock() : "CONCAT(LEFT(DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%f'),23),'Z')";
function actor(viewer: ProjectViewer) { return voteId(viewer.userId); }
function member(viewer: ProjectViewer, project = "p.id") {
  return { sql: `EXISTS(SELECT 1 FROM project_members voting_member JOIN users voting_user ON voting_user.id=voting_member.user_id WHERE voting_member.project_id=${project} AND voting_member.active=1 AND voting_user.id=? AND LOWER(TRIM(voting_user.email))=?)`, params: [actor(viewer), viewer.email?.trim().toLowerCase() ?? ""] };
}
async function authority(viewer: ProjectViewer, projectId: number) {
  voteId(projectId); const access = projectPortalAccessGuard(viewer), manage = projectPortalManagementGuard(viewer), vote = member(viewer);
  const row = (await query(`SELECT CASE WHEN ${manage.sql} THEN 1 ELSE 0 END can_manage,CASE WHEN ${vote.sql} THEN 1 ELSE 0 END can_vote,${nowSql()} server_now FROM projects p WHERE p.id=? AND ${access.sql}`, [...manage.params, ...vote.params, projectId, ...access.params]))[0];
  if (!row) throw new ProjectVoteError("NOT_FOUND");
  return { canManage: Number(row.can_manage) === 1, canVote: Number(row.can_vote) === 1, serverNow: String(row.server_now) };
}
function mapPoll(row: Row): ProjectPoll {
  let labels: unknown; try { labels = JSON.parse(String(row.options_json)); } catch { throw new ProjectVoteError("UNAVAILABLE"); }
  if (!Array.isArray(labels) || labels.length < 2 || labels.length > 10 || labels.some(value => typeof value !== "string")) throw new ProjectVoteError("UNAVAILABLE");
  return { id: Number(row.id), projectId: Number(row.project_id), title: String(row.title), description: String(row.description), startsAt: String(row.starts_at), endsAt: String(row.ends_at), phase: row.phase as ProjectPoll["phase"], options: labels.map((label, i) => ({ id: i + 1, label })), ownChoice: row.own_choice == null ? null : Number(row.own_choice), results: null, totalVotes: null };
}
async function rows(viewer: ProjectViewer, projectId: number, pollId: number | null, after = 0) {
  const access = projectPortalAccessGuard(viewer), uid = actor(viewer);
  return query(`SELECT v.id,v.project_id,v.title,v.description,v.starts_at,v.ends_at,v.options_json,CASE WHEN ${nowSql()}<v.starts_at THEN 'scheduled' WHEN ${nowSql()}>=v.ends_at THEN 'closed' ELSE 'open' END phase,(SELECT b.option_id FROM project_poll_ballots b WHERE b.poll_id=v.id AND b.user_id=?) own_choice FROM project_polls v JOIN projects p ON p.id=v.project_id WHERE p.id=? AND ${access.sql} AND ${pollId == null ? "v.id>?" : "v.id=?"} ORDER BY v.id LIMIT 21`, [uid, projectId, ...access.params, pollId ?? after]);
}
/** SQL only returns anonymous option totals after close, including for privileged viewers. */
async function finish(viewer: ProjectViewer, poll: ProjectPoll) {
  if (poll.phase !== "closed") { await authority(viewer, poll.projectId); return poll; }
  const access = projectPortalAccessGuard(viewer);
  const totals = await query(`SELECT b.option_id,COUNT(*) votes FROM project_poll_ballots b JOIN project_polls v ON v.id=b.poll_id JOIN projects p ON p.id=v.project_id WHERE v.id=? AND p.id=? AND ${access.sql} AND ${nowSql()}>=v.ends_at GROUP BY b.option_id`, [poll.id, poll.projectId, ...access.params]);
  // Recheck current membership even if there were zero ballots (empty aggregate cannot prove access).
  await authority(viewer, poll.projectId);
  poll.results = poll.options.map(option => ({ optionId: option.id, count: Number(totals.find(row => Number(row.option_id) === option.id)?.votes ?? 0) }));
  poll.totalVotes = poll.results.reduce((sum, option) => sum + option.count, 0); return poll;
}
export async function getProjectPoll(viewer: ProjectViewer, projectId: number, pollId: number): Promise<ProjectPoll> {
  voteId(projectId); voteId(pollId); const found = await rows(viewer, projectId, pollId); if (!found[0]) throw new ProjectVoteError("NOT_FOUND");
  return finish(viewer, mapPoll(found[0]));
}
export async function listProjectPolls(viewer: ProjectViewer, projectId: number, after = 0): Promise<PollList> {
  if (!Number.isSafeInteger(after) || after < 0) throw new ProjectVoteError("INVALID_INPUT");
  const allowed = await authority(viewer, projectId), found = await rows(viewer, projectId, null, after);
  const polls: ProjectPoll[] = []; for (const row of found.slice(0, 20)) polls.push(await finish(viewer, mapPoll(row)));
  await authority(viewer, projectId);
  return { ...allowed, polls, nextCursor: found.length > 20 ? Number(found[19].id) : null };
}
export async function createProjectPoll(viewer: ProjectViewer, projectId: number, raw: CreatePollInput): Promise<ProjectPoll> {
  voteId(projectId); const input = normalizePollInput(raw), uid = actor(viewer), manage = projectPortalManagementGuard(viewer);
  const fingerprint = createHash("sha256").update(JSON.stringify({ projectId, uid, ...input })).digest("hex");
  const receipt = async () => (await query(`SELECT v.id,v.request_hash FROM project_polls v JOIN projects p ON p.id=v.project_id WHERE p.id=? AND v.created_by=? AND v.mutation_key=? AND ${manage.sql}`, [projectId, uid, input.mutationKey, ...manage.params]))[0];
  const old = await receipt();
  if (old) { if (old.request_hash !== fingerprint) throw new ProjectVoteError("CONFLICT"); return getProjectPoll(viewer, projectId, Number(old.id)); }
  if (!(await authority(viewer, projectId)).canManage) throw new ProjectVoteError("NOT_FOUND");
  let insertFailed = false;
  try {
    await getDatabasePool().query(`INSERT INTO project_polls(project_id,title,description,starts_at,ends_at,options_json,created_by,created_at,mutation_key,request_hash) SELECT p.id,?,?,?,?,?,?,${nowSql()},?,? FROM projects p WHERE p.id=? AND ${manage.sql} AND ?>${nowSql()}`, [input.title, input.description, input.startsAt, input.endsAt, JSON.stringify(input.options), uid, input.mutationKey, fingerprint, projectId, ...manage.params, input.endsAt]);
  } catch { insertFailed = true; /* A raced create is successful only through its actor-bound receipt. */ }
  const saved = await receipt();
  if (!saved) { if (!(await authority(viewer, projectId)).canManage) throw new ProjectVoteError("NOT_FOUND"); throw new ProjectVoteError(insertFailed ? "UNAVAILABLE" : "INVALID_INPUT"); }
  if (saved.request_hash !== fingerprint) throw new ProjectVoteError("CONFLICT");
  return getProjectPoll(viewer, projectId, Number(saved.id));
}
export async function castProjectVote(viewer: ProjectViewer, projectId: number, pollId: number, optionId: number): Promise<ProjectPoll> {
  voteId(projectId); voteId(pollId); if (!Number.isInteger(optionId) || optionId < 1 || optionId > 10) throw new ProjectVoteError("INVALID_INPUT");
  const uid = actor(viewer), vote = member(viewer), poll = await getProjectPoll(viewer, projectId, pollId);
  if (!(await authority(viewer, projectId)).canVote) throw new ProjectVoteError("NOT_FOUND");
  if (!poll.options.some(option => option.id === optionId)) throw new ProjectVoteError("INVALID_INPUT");
  const countExpression = isHostedRuntime() ? "json_array_length(v.options_json)" : "JSON_LENGTH(v.options_json)";
  const update = isHostedRuntime() ? "ON CONFLICT(poll_id,user_id) DO UPDATE SET option_id=excluded.option_id,updated_at=excluded.updated_at,write_token=excluded.write_token" : "ON DUPLICATE KEY UPDATE option_id=VALUES(option_id),updated_at=VALUES(updated_at),write_token=VALUES(write_token)";
  let affectedRows = 0;
  try {
  const write = await getDatabasePool().query(`INSERT INTO project_poll_ballots(poll_id,project_id,user_id,option_id,updated_at,write_token) SELECT v.id,v.project_id,?,?,${nowSql()},? FROM project_polls v JOIN projects p ON p.id=v.project_id WHERE v.id=? AND p.id=? AND ${vote.sql} AND v.starts_at<=${nowSql()} AND v.ends_at>${nowSql()} AND ?<=${countExpression} ${update}`, [uid, optionId, randomUUID(), pollId, projectId, ...vote.params, optionId]) as { affectedRows?: number };
  affectedRows = Number(write.affectedRows ?? 0);
  } catch { throw new ProjectVoteError("UNAVAILABLE"); }
  const result = await getProjectPoll(viewer, projectId, pollId);
  if (affectedRows === 0) {
    if (!(await authority(viewer, projectId)).canVote) throw new ProjectVoteError("NOT_FOUND");
    throw new ProjectVoteError(result.phase === "open" ? "CONFLICT" : "VOTING_CLOSED");
  }
  if (result.ownChoice !== optionId) throw new ProjectVoteError("CONFLICT");
  return result;
}
