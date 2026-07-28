import assert from "node:assert/strict";
import test from "node:test";
import { buildPlan, protectOciRelations } from "../dist/policy.js";
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

const evidence = ({ children = [], subjects = [], unknown = [] } = {}) => ({
  children: new Map(children),
  subjects: new Map(subjects),
  unknown: new Set(unknown),
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
    const { gatherOciEvidence } = await import(`../dist/oci.js?t=${Date.now()}`);
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
    const { gatherOciEvidence } = await import(`../dist/oci.js?t=${Date.now()}`);
    const versions = [1, 2].map((id) => v(id, [], 100));
    const result = await gatherOciEvidence(config, versions);
    assert.deepEqual([...result.unknown].sort(), ["sha256:1", "sha256:2"]);
    assert.deepEqual(mock.calls.manifests, []);
  } finally {
    await mock.close();
  }
});
