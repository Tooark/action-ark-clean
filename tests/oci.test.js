import assert from "node:assert/strict";
import test from "node:test";
import { confirmAbsent, gatherOciEvidence } from "../dist/oci.js";
import { buildPlan, protectOciRelations, releaseOrphanReferrers, unresolvedSubjects } from "../dist/policy.js";
import { startMockRegistry } from "./helpers/mock-registry.mjs";

const rule = (v) =>
  v.startsWith("/") ? { kind: "regex", value: v, regex: new RegExp(v.slice(1, -1)) } : { kind: "exact", value: v };

const config = {
  token: "x",
  owner: "Tooark",
  ownerType: "organization",
  packageName: "demo",
  protectedRules: [rule("latest")],
  ephemeralRules: [rule("/^sha-/")],
  ephemeralDays: 30,
  untaggedDays: 7,
  keepLatest: 0,
  deleteUntagged: true,
  alwaysKeepNewest: false,
  protectMultiArch: true,
  protectReferrers: true,
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

const NOW = new Date("2026-07-28T00:00:00Z");
const v = (id, tags, days) => ({
  id,
  name: `sha256:${id}`,
  tags,
  createdAt: new Date(NOW.getTime() - days * 86400000).toISOString(),
  updatedAt: "",
});

const evidence = ({ children = [], subjects = [], unknown = [], sizes = [] } = {}) => ({
  children: new Map(children),
  subjects: new Map(subjects),
  unknown: new Set(unknown),
  sizes: new Map(sizes),
});

const decision = (plan, id) => plan.decisions.find((d) => d.versionId === id);

test("untagged child of a retained index is protected as PROTECTED_OCI_CHILD", () => {
  const plan = buildPlan(config, [v(1, ["latest"], 100), v(2, [], 100)], NOW);
  assert.equal(decision(plan, 2).disposition, "eligible");
  const after = protectOciRelations(plan, evidence({ children: [["sha256:1", ["sha256:2"]]] }), config);
  assert.equal(decision(after, 2).reason, "PROTECTED_OCI_CHILD");
  assert.equal(decision(after, 2).matchedRule, "sha256:1");
  assert.equal(after.counts.eligible, 0);
});

test("referrer with subject pointing at a retained version is protected", () => {
  const plan = buildPlan(config, [v(1, ["latest"], 100), v(2, [], 100)], NOW);
  const after = protectOciRelations(plan, evidence({ subjects: [["sha256:2", "sha256:1"]] }), config);
  assert.equal(decision(after, 2).reason, "PROTECTED_OCI_REFERRER");
});

test("cosign tag-scheme referrer of a retained digest is protected", () => {
  const digestHex = "a".repeat(64);
  const versions = [{ ...v(1, ["latest"], 100), name: `sha256:${digestHex}` }, v(2, [`sha256-${digestHex}.sig`], 100)];
  // The sig tag matches no ephemeral rule, so make it otherwise eligible.
  const cfg = { ...config, ephemeralRules: [rule("/^sha256-/")] };
  const plan = buildPlan(cfg, versions, NOW);
  assert.equal(decision(plan, 2).disposition, "eligible");
  const after = protectOciRelations(plan, evidence(), cfg);
  assert.equal(decision(after, 2).reason, "PROTECTED_OCI_REFERRER");
  assert.equal(decision(after, 2).matchedRule, `sha256:${digestHex}`);
});

test("unknown relation on an eligible version fails closed", () => {
  const plan = buildPlan(config, [v(1, ["latest"], 100), v(2, [], 100)], NOW);
  const after = protectOciRelations(plan, evidence({ unknown: ["sha256:2"] }), config);
  assert.equal(decision(after, 2).reason, "PROTECTED_UNKNOWN_RELATION");
});

test("unknown manifest on a retained version protects all eligible untagged", () => {
  const plan = buildPlan(config, [v(1, ["latest"], 100), v(2, [], 100), v(3, ["sha-x"], 100)], NOW);
  const after = protectOciRelations(plan, evidence({ unknown: ["sha256:1"] }), config);
  assert.equal(decision(after, 2).reason, "PROTECTED_UNKNOWN_RELATION");
  // Tagged ephemeral versions are not children; they stay eligible.
  assert.equal(decision(after, 3).disposition, "eligible");
});

test("protection propagates transitively to a fixpoint", () => {
  // 1 (latest) -> child 2 (nested index) -> child 3
  const plan = buildPlan(config, [v(1, ["latest"], 100), v(2, [], 100), v(3, [], 100)], NOW);
  const after = protectOciRelations(
    plan,
    evidence({
      children: [
        ["sha256:1", ["sha256:2"]],
        ["sha256:2", ["sha256:3"]],
      ],
    }),
    config,
  );
  assert.equal(decision(after, 2).reason, "PROTECTED_OCI_CHILD");
  assert.equal(decision(after, 3).reason, "PROTECTED_OCI_CHILD");
  assert.equal(decision(after, 3).matchedRule, "sha256:2");
});

test("disabled flags leave the plan untouched", () => {
  const plan = buildPlan(config, [v(1, ["latest"], 100), v(2, [], 100)], NOW);
  const off = { protectMultiArch: false, protectReferrers: false };
  const after = protectOciRelations(
    plan,
    evidence({ children: [["sha256:1", ["sha256:2"]]], unknown: ["sha256:2"] }),
    off,
  );
  assert.deepEqual(after, plan);
});

const DIGEST = "a".repeat(64);
const orphanCfg = { ...config, deleteOrphanedReferrers: true };

test("orphan referrer with subject confirmed absent becomes eligible", () => {
  // Cosign-tagged referrer: matches no rule, so it is weakly retained.
  const plan = buildPlan(orphanCfg, [v(1, ["latest"], 100), v(2, [`sha256-${DIGEST}.sig`], 100)], NOW);
  assert.equal(decision(plan, 2).reason, "PROTECTED_UNMATCHED_TAG");

  const unresolved = unresolvedSubjects(plan, evidence());
  assert.deepEqual([...unresolved], [`sha256:${DIGEST}`]);

  const after = releaseOrphanReferrers(plan, evidence(), new Set([`sha256:${DIGEST}`]), orphanCfg);
  assert.equal(decision(after, 2).disposition, "eligible");
  assert.equal(decision(after, 2).reason, "ELIGIBLE_ORPHAN_REFERRER");
  assert.equal(decision(after, 2).matchedRule, `sha256:${DIGEST}`);
  assert.equal(after.counts.eligible, 1);
});

test("untagged referrer known via subject field is released when its subject is absent", () => {
  // delete-untagged off: the untagged referrer is weakly retained as TOO_RECENT.
  const cfg = { ...orphanCfg, deleteUntagged: false };
  const plan = buildPlan(cfg, [v(1, ["latest"], 100), v(2, [], 100)], NOW);
  assert.equal(decision(plan, 2).reason, "PROTECTED_TOO_RECENT");

  const ev = evidence({ subjects: [["sha256:2", `sha256:${DIGEST}`]] });
  assert.deepEqual([...unresolvedSubjects(plan, ev)], [`sha256:${DIGEST}`]);
  const after = releaseOrphanReferrers(plan, ev, new Set([`sha256:${DIGEST}`]), cfg);
  assert.equal(decision(after, 2).reason, "ELIGIBLE_ORPHAN_REFERRER");
});

test("orphan release fails closed when absence is not confirmed", () => {
  const plan = buildPlan(orphanCfg, [v(1, ["latest"], 100), v(2, [`sha256-${DIGEST}.sig`], 100)], NOW);
  const after = releaseOrphanReferrers(plan, evidence(), new Set(), orphanCfg);
  assert.equal(decision(after, 2).reason, "PROTECTED_UNMATCHED_TAG");
});

test("orphan release never touches a referrer whose subject is in the inventory", () => {
  // Subject sha256:1 exists in the inventory (even though listed as absent by mistake).
  const versions = [{ ...v(1, [], 100), name: `sha256:${DIGEST}` }, v(2, [`sha256-${DIGEST}.sig`], 100)];
  const plan = buildPlan({ ...orphanCfg, deleteUntagged: false }, versions, NOW);
  assert.equal(unresolvedSubjects(plan, evidence()).size, 0);
  const after = releaseOrphanReferrers(plan, evidence(), new Set([`sha256:${DIGEST}`]), orphanCfg);
  assert.equal(decision(after, 2).reason, "PROTECTED_UNMATCHED_TAG");
});

test("orphan release never overrides a protected tag", () => {
  const cfg = { ...orphanCfg, protectedRules: [rule("latest"), rule(`/^sha256-/`)] };
  const plan = buildPlan(cfg, [v(1, ["latest"], 100), v(2, [`sha256-${DIGEST}.sig`], 100)], NOW);
  assert.equal(decision(plan, 2).reason, "PROTECTED_TAG");
  const after = releaseOrphanReferrers(plan, evidence(), new Set([`sha256:${DIGEST}`]), cfg);
  assert.equal(decision(after, 2).reason, "PROTECTED_TAG");
});

test("orphan release is a no-op when the input is disabled", () => {
  const plan = buildPlan(config, [v(1, ["latest"], 100), v(2, [`sha256-${DIGEST}.sig`], 100)], NOW);
  const after = releaseOrphanReferrers(plan, evidence(), new Set([`sha256:${DIGEST}`]), config);
  assert.deepEqual(after, plan);
});

test("confirmAbsent only trusts explicit 404s", async () => {
  const missing = `sha256:${"b".repeat(64)}`;
  const present = `sha256:${"c".repeat(64)}`;
  const broken = `sha256:${"d".repeat(64)}`;
  const mock = await startMockRegistry({ manifests: { [missing]: 404, [broken]: 500 } });
  try {
    process.env.ARKLEAN_REGISTRY_URL = mock.url;

    const absent = await confirmAbsent(config, [missing, present, broken]);
    assert.deepEqual([...absent], [missing]);
  } finally {
    await mock.close();
  }
});

test("confirmAbsent confirms nothing when the token exchange fails", async () => {
  const mock = await startMockRegistry({ registryTokenStatus: 401 });
  try {
    process.env.ARKLEAN_REGISTRY_URL = mock.url;

    const absent = await confirmAbsent(config, [`sha256:${"b".repeat(64)}`]);
    assert.equal(absent.size, 0);
    assert.deepEqual(mock.calls.manifests, []);
  } finally {
    await mock.close();
  }
});

test("gatherOciEvidence collects manifest sizes for images and indexes", async () => {
  const mock = await startMockRegistry({
    manifests: {
      "sha256:1": { config: { size: 100 }, layers: [{ size: 1000 }, { size: 2000 }] },
      "sha256:2": {
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: [{ digest: "sha256:1", size: 700 }],
      },
    },
  });
  try {
    process.env.ARKLEAN_REGISTRY_URL = mock.url;

    const result = await gatherOciEvidence(config, [v(1, [], 100), v(2, [], 100), v(3, [], 100)]);
    assert.equal(result.sizes.get("sha256:1"), 3100);
    assert.equal(result.sizes.get("sha256:2"), 700);
    // Default mock manifest has no sizes: no entry rather than a misleading 0.
    assert.equal(result.sizes.has("sha256:3"), false);
  } finally {
    await mock.close();
  }
});

test("gatherOciEvidence collects children, subjects, and unknowns", async () => {
  const mock = await startMockRegistry({
    manifests: {
      "sha256:1": {
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: [{ digest: "sha256:2" }, { digest: "sha256:3" }],
      },
      "sha256:4": {
        mediaType: "application/vnd.oci.image.manifest.v1+json",
        subject: { digest: "sha256:1" },
      },
      "sha256:5": 404,
    },
  });
  try {
    process.env.ARKLEAN_REGISTRY_URL = mock.url;

    const versions = [1, 2, 3, 4, 5].map((id) => v(id, [], 100));
    const result = await gatherOciEvidence(config, versions);
    assert.deepEqual(result.children.get("sha256:1"), ["sha256:2", "sha256:3"]);
    assert.equal(result.subjects.get("sha256:4"), "sha256:1");
    assert.deepEqual([...result.unknown], ["sha256:5"]);
    assert.equal(mock.calls.token, 1);
  } finally {
    await mock.close();
  }
});

test("gatherOciEvidence marks everything unknown when token exchange fails", async () => {
  const mock = await startMockRegistry({ registryTokenStatus: 401 });
  try {
    process.env.ARKLEAN_REGISTRY_URL = mock.url;

    const versions = [1, 2].map((id) => v(id, [], 100));
    const result = await gatherOciEvidence(config, versions);
    assert.deepEqual([...result.unknown].sort(), ["sha256:1", "sha256:2"]);
    assert.deepEqual(mock.calls.manifests, []);
  } finally {
    await mock.close();
  }
});
