import assert from "node:assert/strict";
import test from "node:test";
import { assertBudget, buildPlan } from "../dist/policy.js";

const rule = (v) =>
  v.startsWith("/") ? { kind: "regex", value: v, regex: new RegExp(v.slice(1, -1)) } : { kind: "exact", value: v };

const config = {
  token: "x",
  owner: "Tooark",
  ownerType: "organization",
  packageName: "demo",
  protectedRules: [rule("latest"), rule("/^v?\\d+(\\.\\d+){2}$/")],
  ephemeralRules: [rule("/^sha-/")],
  ephemeralDays: 30,
  untaggedDays: 7,
  keepLatest: 1,
  deleteUntagged: true,
  alwaysKeepNewest: true,
  dryRun: true,
  confirmDelete: "",
  failOnEmpty: false,
  verifyInventoryBeforeApply: true,
  validateAfterCleanup: true,
  maxDeletions: 10,
  maxDeletePercentage: 100,
  concurrency: 2,
  retryCount: 0,
};

const NOW = new Date("2026-07-28T00:00:00Z");
const v = (id, tags, days) => ({
  id,
  name: `sha256:${id}`,
  tags,
  createdAt: new Date(NOW.getTime() - days * 86400000).toISOString(),
  updatedAt: "",
});

test("protected tag wins over ephemeral tag", () => {
  const p = buildPlan(config, [v(1, ["latest", "sha-old"], 100)], NOW);
  assert.equal(p.decisions[0].reason, "PROTECTED_TAG");
});

test("keeps newest eligible tagged version", () => {
  const p = buildPlan(config, [v(1, ["sha-a"], 90), v(2, ["sha-b"], 60)], NOW);
  assert.equal(p.decisions.find((x) => x.versionId === 2).reason, "PROTECTED_KEEP_LATEST");
  assert.equal(p.counts.eligible, 1);
});

test("deletes old untagged", () => {
  const p = buildPlan({ ...config, keepLatest: 0, alwaysKeepNewest: false }, [v(1, [], 8)], NOW);
  assert.equal(p.counts.eligible, 1);
});

test("budget fails closed with ABORTED_BUDGET_EXCEEDED", () => {
  const p = buildPlan({ ...config, keepLatest: 0, alwaysKeepNewest: false }, [v(1, [], 8)], NOW);
  assert.throws(() => assertBudget({ ...config, maxDeletions: 0 }, p), /ABORTED_BUDGET_EXCEEDED/);
  assert.throws(() => assertBudget({ ...config, maxDeletePercentage: 0 }, p), /ABORTED_BUDGET_EXCEEDED/);
});

test("always-keep-newest uses PROTECTED_NEWEST reason", () => {
  const p = buildPlan({ ...config, keepLatest: 0 }, [v(1, [], 90), v(2, [], 8)], NOW);
  assert.equal(p.decisions.find((x) => x.versionId === 2).reason, "PROTECTED_NEWEST");
});

test("keep-latest reason wins over newest reason when both apply", () => {
  const p = buildPlan(config, [v(1, ["sha-a"], 90), v(2, ["sha-b"], 60)], NOW);
  assert.equal(p.decisions.find((x) => x.versionId === 2).reason, "PROTECTED_KEEP_LATEST");
});

test("recent untagged version is PROTECTED_TOO_RECENT", () => {
  const p = buildPlan({ ...config, alwaysKeepNewest: false }, [v(1, [], 2)], NOW);
  assert.equal(p.decisions[0].reason, "PROTECTED_TOO_RECENT");
});

test("tagged version not matching ephemeral rules is retained", () => {
  const p = buildPlan(config, [v(1, ["release-candidate"], 400)], NOW);
  assert.equal(p.decisions[0].reason, "PROTECTED_UNMATCHED_TAG");
});

test("plan is deterministic for identical inputs", () => {
  const versions = [v(1, ["sha-a"], 90), v(2, [], 40), v(3, ["latest"], 10)];
  const a = buildPlan(config, versions, NOW);
  const b = buildPlan(config, versions, NOW);
  assert.deepEqual(a, b);
});
