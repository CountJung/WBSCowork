import test from "node:test";
import assert from "node:assert/strict";
import { normalizePollInput, ProjectVoteError, voteId } from "../../src/entities/project-vote";
const sample = () => ({ title: "합성 안건", description: "설명", startsAt: "2026-11-03T10:00:00+09:00", endsAt: "2026-11-04T10:00:00+09:00", options: ["찬성", "반대"], mutationKey: "f761555f-f4ee-4cc6-8e92-37c215ad9f84" });
const invalid = (value: Parameters<typeof normalizePollInput>[0]) => assert.throws(() => normalizePollInput(value), error => error instanceof ProjectVoteError && error.status === 400);
test("poll normalization trims text and uses unambiguous UTC timestamps", () => {
 const value = normalizePollInput({ ...sample(), title: " 안건 " }); assert.equal(value.title, "안건"); assert.equal(value.startsAt, "2026-11-03T01:00:00.000Z");
});
test("poll periods reject ambiguous timezone, invalid calendar and invalid clock values", () => {
 for (const startsAt of ["2026-02-30T10:00:00Z", "2025-02-29T10:00:00Z", "2026-13-01T00:00:00Z", "2026-11-03T24:00:00Z", "2026-11-03T00:00:00+25:00", "2026-11-03T00:00:00", "not a date"]) invalid({ ...sample(), startsAt });
 invalid({ ...sample(), endsAt: sample().startsAt }); invalid({ ...sample(), endsAt: "2026-11-02T10:00:00Z" });
});
test("poll bounds reject blank, duplicate and excessive options and forged receipt keys", () => {
 for (const options of [["a"], ["a", " "], ["A", " a "], Array.from({ length: 11 }, (_, i) => String(i)), ["a".repeat(121), "b"]]) invalid({ ...sample(), options });
 invalid({ ...sample(), title: " " }); invalid({ ...sample(), description: "x".repeat(2001) }); invalid({ ...sample(), mutationKey: "replay" });
});
test("poll route identifiers reject coercion/unsafe/noncanonical input", () => {
 for (const id of [0, -1, "01", "1e2", "1.0", "9007199254740992", {}, null]) assert.throws(() => voteId(id));
 assert.equal(voteId("123"), 123);
});
