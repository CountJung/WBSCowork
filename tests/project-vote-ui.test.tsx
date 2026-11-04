/** SSR/privacy/time-input contracts. No browser interaction or live authorization is inferred. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ProjectVoting from "../src/widgets/project-vote/ui/ProjectVoting";
import { votingKstToIso } from "../src/widgets/project-vote/model/datetime";
import type { PollList, ProjectPoll } from "../src/entities/project-vote";

const poll: ProjectPoll = {
  id: 10, projectId: 6, title: "합성 봉사 시간 선택", description: "하나를 선택하세요.",
  startsAt: "2026-11-03T00:00:00.000Z", endsAt: "2026-11-03T01:00:00.000Z", phase: "open",
  options: [{ id: 1, label: "오전" }, { id: 2, label: "오후" }], ownChoice: null, results: null, totalVotes: null,
};
const list = (changes: Partial<PollList> = {}): PollList => ({ polls: [poll], canManage: false, canVote: true, nextCursor: null, serverNow: "2026-11-03T00:30:00.000Z", ...changes });
const render = (data: PollList) => renderToStaticMarkup(<ProjectVoting projectId={6} initial={data} />);

test("member voting is a labeled single-choice form without creation controls or interim counts", () => {
  const html = render(list());
  assert.match(html, /type="radio"/);
  assert.match(html, /<fieldset[^>]*aria-describedby="poll-10-help"/);
  assert.match(html, /<legend/);
  assert.match(html, /투표 저장/);
  assert.match(html, /2026\. 11\. 03\. 오전 09:00 KST/);
  assert.doesNotMatch(html, /새 투표 안건 등록|마감된 투표 결과|총 \d+표/);
  assert.match(html, /서버에는 계정별 선택을 저장/);
});
test("admin receives bounded creation fields, explicit KST dates and no mutable-poll controls", () => {
  const html = render(list({ canManage: true }));
  assert.match(html, /새 투표 안건 등록/);
  assert.equal((html.match(/type="datetime-local"/g) ?? []).length, 2);
  assert.match(html, /시작 시각 · KST/);
  assert.match(html, /한국 표준시\(KST, UTC\+9\)/);
  assert.match(html, /등록 후에는 안건·선택지·기간을 수정하거나 삭제할 수 없습니다/);
  assert.doesNotMatch(html, /마감된 투표 결과|총 \d+표/);
});
test("scheduled ballots and unassigned SU management never render a vote form", () => {
  const scheduled = render(list({ polls: [{ ...poll, phase: "scheduled" }] }));
  assert.match(scheduled, /투표 시작 전입니다/);
  assert.doesNotMatch(scheduled, /type="radio"|투표 저장/);
  const su = render(list({ canManage: true, canVote: false }));
  assert.match(su, /새 투표 안건 등록/);
  assert.match(su, /관리 권한만으로 투표권이 추가되지는 않습니다/);
  assert.doesNotMatch(su, /type="radio"|투표 저장/);
});
test("closed polls show aggregate totals only; open DTO cannot accidentally render supplied result counts", () => {
  const results = [{ optionId: 1, count: 2 }, { optionId: 2, count: 1 }];
  const closed = render(list({ polls: [{ ...poll, phase: "closed", results, totalVotes: 3 }] }));
  assert.match(closed, /익명 집계 결과 · 총 3표/);
  assert.match(closed, /오전: 2표 \(67%\)/);
  assert.doesNotMatch(closed, /type="radio"|투표 저장/);
  const open = render(list({ polls: [{ ...poll, results, totalVotes: 3 }], canManage: true }));
  assert.doesNotMatch(open, /익명 집계 결과 · 총|오전: 2표/);
});
test("own saved choice is selected and described as replaceable without names or unrelated ballots", () => {
  const html = render(list({ polls: [{ ...poll, ownChoice: 2 }] }));
  assert.match(html, /선택 변경 저장/);
  assert.match(html, /이미 저장한 선택이 있습니다/);
  assert.match(html, /checked=""[^>]*value="2"|value="2"[^>]*checked=""/);
});
test("empty state and paginated list have explicit refresh/retry navigation", () => {
  const empty = render(list({ polls: [], nextCursor: null }));
  assert.match(empty, /등록된 투표 안건이 없습니다/);
  assert.match(empty, /투표 목록·현재 상태 다시 확인/);
  assert.doesNotMatch(empty, /투표 더 보기/);
  assert.match(render(list({ nextCursor: 10 })), /투표 더 보기/);
});
test("KST input converts explicitly across UTC date boundaries and rejects invalid normalization", () => {
  assert.equal(votingKstToIso("2026-11-03T00:00"), "2026-11-02T15:00:00.000Z");
  assert.equal(votingKstToIso("2028-02-29T23:59"), "2028-02-29T14:59:00.000Z");
  for (const value of ["", "2026-11-03", "2026-02-29T12:00", "2026-04-31T12:00", "2026-11-03T24:00", "2026-11-03T12:60", "2026-11-03T12:00Z", "0000-01-01T00:00"]) assert.throws(() => votingKstToIso(value), value);
});
