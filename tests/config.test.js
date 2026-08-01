import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, rules } from "../dist/config.js";

const BASE_ENV = {
  INPUT_TOKEN: "ghp_test",
  INPUT_OWNER: "Tooark",
  INPUT_PACKAGE: "demo",
};

function withEnv(env, fn) {
  const saved = {};
  for (const key of Object.keys(process.env))
    if (key.startsWith("INPUT_")) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  Object.assign(process.env, BASE_ENV, env);
  try {
    return fn();
  } finally {
    for (const key of Object.keys(process.env)) if (key.startsWith("INPUT_")) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

test("rules parses exact values, regexes, comments, and blank lines", () => {
  const parsed = rules("latest\n# comment\n\n/^sha-/\n  stable  ");
  assert.deepEqual(
    parsed.map((r) => r.kind),
    ["exact", "regex", "exact"],
  );
  assert.equal(parsed[1].regex.test("sha-abc"), true);
  assert.equal(parsed[2].value, "stable");
});

test("rules rejects invalid regex", () => {
  assert.throws(() => rules("/[unclosed/"), /Invalid regular expression/);
});

test("rules rejects more than 50 lines", () => {
  const many = Array.from({ length: 51 }, (_, i) => `tag-${i}`).join("\n");
  assert.throws(() => rules(many), /No more than 50/);
});

test("rules rejects lines over 256 characters", () => {
  assert.throws(() => rules("x".repeat(257)), /exceeds 256/);
});

test("loadConfig applies documented defaults", () => {
  const c = withEnv({}, loadConfig);
  assert.equal(c.ownerType, "auto");
  assert.equal(c.dryRun, true);
  assert.equal(c.deleteUntagged, false);
  assert.equal(c.alwaysKeepNewest, true);
  assert.equal(c.verifyInventoryBeforeApply, true);
  assert.equal(c.validateAfterCleanup, true);
  assert.equal(c.protectMultiArch, true);
  assert.equal(c.protectReferrers, true);
  assert.equal(c.deleteOrphanedReferrers, false);
  assert.equal(c.ephemeralDays, 30);
  assert.equal(c.untaggedDays, 7);
  assert.equal(c.keepLatest, 10);
  assert.equal(c.maxDeletions, 20);
  assert.equal(c.maxDeletePercentage, 25);
  assert.equal(c.budgetMode, "abort");
  assert.equal(c.concurrency, 2);
  assert.equal(c.retryCount, 3);
});

test("loadConfig parses delete-orphaned-referrers strictly", () => {
  assert.equal(withEnv({ "INPUT_DELETE-ORPHANED-REFERRERS": "true" }, loadConfig).deleteOrphanedReferrers, true);
  assert.throws(() => withEnv({ "INPUT_DELETE-ORPHANED-REFERRERS": "yes" }, loadConfig), /must be true or false/);
});

test("loadConfig validates budget-mode", () => {
  assert.equal(withEnv({ "INPUT_BUDGET-MODE": "cap" }, loadConfig).budgetMode, "cap");
  assert.throws(() => withEnv({ "INPUT_BUDGET-MODE": "slice" }, loadConfig), /budget-mode must be abort or cap/);
});

test("loadConfig requires token, owner, and package", () => {
  assert.throws(() => withEnv({ INPUT_TOKEN: "" }, loadConfig), /Missing required input: token/);
  assert.throws(() => withEnv({ INPUT_OWNER: "" }, loadConfig), /Missing required input: owner/);
  assert.throws(() => withEnv({ INPUT_PACKAGE: "" }, loadConfig), /Missing required input: package/);
});

test("loadConfig rejects unknown owner-type", () => {
  assert.throws(
    () => withEnv({ "INPUT_OWNER-TYPE": "team" }, loadConfig),
    /owner-type must be auto, organization, or user/,
  );
});

test("loadConfig accepts explicit owner-type values", () => {
  assert.equal(withEnv({ "INPUT_OWNER-TYPE": "organization" }, loadConfig).ownerType, "organization");
  assert.equal(withEnv({ "INPUT_OWNER-TYPE": "user" }, loadConfig).ownerType, "user");
});

test("loadConfig enforces integer bounds", () => {
  assert.throws(() => withEnv({ INPUT_CONCURRENCY: "0" }, loadConfig), /between 1 and 10/);
  assert.throws(() => withEnv({ INPUT_CONCURRENCY: "11" }, loadConfig), /between 1 and 10/);
  assert.throws(() => withEnv({ "INPUT_RETRY-COUNT": "6" }, loadConfig), /between 0 and 5/);
  assert.throws(() => withEnv({ "INPUT_MAX-DELETE-PERCENTAGE": "101" }, loadConfig), /between 0 and 100/);
  assert.throws(() => withEnv({ "INPUT_KEEP-LATEST": "-1" }, loadConfig), /must be an integer/);
  assert.throws(() => withEnv({ "INPUT_KEEP-LATEST": "abc" }, loadConfig), /must be an integer/);
});

test("loadConfig enforces strict booleans", () => {
  assert.throws(() => withEnv({ "INPUT_DRY-RUN": "yes" }, loadConfig), /must be true or false/);
  assert.equal(withEnv({ "INPUT_DRY-RUN": "false" }, loadConfig).dryRun, false);
});
