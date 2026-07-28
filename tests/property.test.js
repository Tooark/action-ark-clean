import assert from "node:assert/strict";
import test from "node:test";
import { buildPlan } from "../dist/policy.js";

// Deterministic LCG so failures are reproducible.
let seed = 42;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const NOW = new Date("2026-07-28T00:00:00Z");
const TAG_POOL = ["latest", "v1.2.3", "sha-abc", "sha-def", "pr-42", "release-x", "stable"];

const rule = (v) =>
  v.startsWith("/") ? { kind: "regex", value: v, regex: new RegExp(v.slice(1, -1)) } : { kind: "exact", value: v };

function randomConfig() {
  return {
    token: "x",
    owner: "Tooark",
    ownerType: "organization",
    packageName: "demo",
    protectedRules: [rule("latest"), rule("/^v\\d/")],
    ephemeralRules: [rule("/^sha-/"), rule("/^pr-/")],
    ephemeralDays: 30,
    untaggedDays: 7,
    keepLatest: Math.floor(rand() * 4),
    deleteUntagged: rand() < 0.5,
    alwaysKeepNewest: rand() < 0.5,
    dryRun: true,
    confirmDelete: "",
    failOnEmpty: false,
    verifyInventoryBeforeApply: true,
    validateAfterCleanup: true,
    maxDeletions: 10000,
    maxDeletePercentage: 100,
    concurrency: 2,
    retryCount: 0,
  };
}

function randomInventory() {
  const n = 1 + Math.floor(rand() * 12);
  return Array.from({ length: n }, (_, i) => {
    const tagCount = Math.floor(rand() * 3);
    const tags = [...new Set(Array.from({ length: tagCount }, () => pick(TAG_POOL)))];
    const days = Math.floor(rand() * 100);
    return {
      id: i + 1,
      name: `sha256:${i + 1}`,
      tags,
      createdAt: new Date(NOW.getTime() - days * 86400000).toISOString(),
      updatedAt: "",
    };
  });
}

const ITERATIONS = 250;

test("adding a protected tag never turns a protected version eligible", () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const config = randomConfig();
    const versions = randomInventory();
    const before = buildPlan(config, versions, NOW);
    for (const d of before.decisions.filter((x) => x.disposition === "eligible" && x.tags.length > 0)) {
      const hardened = {
        ...config,
        protectedRules: [...config.protectedRules, rule(d.tags[0])],
      };
      const after = buildPlan(hardened, versions, NOW);
      const decision = after.decisions.find((x) => x.versionId === d.versionId);
      assert.equal(
        decision.disposition,
        "protected",
        `version ${d.versionId} with tag ${d.tags[0]} must become protected (iteration ${i})`,
      );
    }
  }
});

test("increasing keep-latest never increases eligible count", () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const config = randomConfig();
    const versions = randomInventory();
    const base = buildPlan(config, versions, NOW);
    const wider = buildPlan({ ...config, keepLatest: config.keepLatest + 1 }, versions, NOW);
    assert.ok(
      wider.counts.eligible <= base.counts.eligible,
      `keep-latest ${config.keepLatest}->${config.keepLatest + 1} raised eligible ` +
        `${base.counts.eligible}->${wider.counts.eligible} (iteration ${i})`,
    );
  }
});

test("plans are deterministic for identical inputs", () => {
  for (let i = 0; i < 50; i++) {
    const config = randomConfig();
    const versions = randomInventory();
    assert.deepEqual(buildPlan(config, versions, NOW), buildPlan(config, versions, NOW));
  }
});

test("every decision carries a reason code and one disposition", () => {
  for (let i = 0; i < ITERATIONS; i++) {
    const plan = buildPlan(randomConfig(), randomInventory(), NOW);
    assert.equal(plan.decisions.length, plan.counts.scanned);
    for (const d of plan.decisions) {
      assert.ok(d.reason, "reason code required");
      assert.ok(["protected", "eligible"].includes(d.disposition));
    }
    assert.equal(plan.counts.protected + plan.counts.eligible, plan.counts.scanned);
  }
});
