import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { apiVersion, startMockRegistry } from "./helpers/mock-registry.mjs";

const OLD = "2026-01-01T00:00:00Z";
const RECENT = "2026-07-27T00:00:00Z";

// Async spawn: the mock registry runs in this process, so the parent event
// loop must stay free to answer the child's HTTP requests (spawnSync would
// deadlock).
function runAction(apiUrl, inputs) {
  const dir = mkdtempSync(join(tmpdir(), "arklean-e2e-"));
  const outputFile = join(dir, "outputs.txt");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["dist/main.js"], {
      cwd: join(import.meta.dirname, ".."),
      env: {
        ...process.env,
        GITHUB_API_URL: apiUrl,
        ARKLEAN_REGISTRY_URL: apiUrl,
        RUNNER_TEMP: dir,
        GITHUB_OUTPUT: outputFile,
        INPUT_TOKEN: "ghp_test",
        INPUT_OWNER: "Tooark",
        INPUT_PACKAGE: "demo",
        "INPUT_PROTECTED-TAGS": "latest",
        "INPUT_EPHEMERAL-TAGS": "/^sha-/",
        "INPUT_MAX-DELETE-PERCENTAGE": "100",
        "INPUT_RETRY-COUNT": "0",
        ...inputs,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      const outputs = {};
      if (existsSync(outputFile)) {
        const raw = readFileSync(outputFile, "utf8");
        for (const m of raw.matchAll(/(\S+)<<ARKLEAN_EOF\n([\s\S]*?)\nARKLEAN_EOF\n/g)) outputs[m[1]] = m[2];
      }
      resolve({ status, stdout, stderr, outputs, dir });
    });
  });
}

const defaultPages = () => [
  [apiVersion(1, ["latest"], OLD), apiVersion(2, ["sha-abc"], OLD), apiVersion(3, ["sha-def"], RECENT)],
];

test("dry-run plans but never deletes", async () => {
  const mock = await startMockRegistry({ pages: defaultPages() });
  try {
    const r = await runAction(mock.url, { "INPUT_KEEP-LATEST": "0" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.outputs.scanned, "3");
    assert.equal(r.outputs.eligible, "1");
    assert.equal(r.outputs.deleted, "0");
    assert.equal(r.outputs["result-path"], "");
    assert.deepEqual(mock.calls.delete, []);
    const plan = JSON.parse(readFileSync(r.outputs["plan-path"], "utf8"));
    assert.equal(plan.planSha256, r.outputs["plan-sha256"]);
    assert.equal(plan.decisions.find((d) => d.versionId === 1).reason, "PROTECTED_TAG");
  } finally {
    await mock.close();
  }
});

test("owner-type auto resolves through the API", async () => {
  const mock = await startMockRegistry({ pages: defaultPages(), ownerType: "Organization" });
  try {
    const r = await runAction(mock.url, {});
    assert.equal(r.status, 0, r.stderr);
    assert.equal(mock.calls.users, 1);
  } finally {
    await mock.close();
  }
});

test("apply without matching confirm-delete aborts before deleting", async () => {
  const mock = await startMockRegistry({ pages: defaultPages() });
  try {
    const r = await runAction(mock.url, { "INPUT_DRY-RUN": "false", "INPUT_KEEP-LATEST": "0" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /confirm-delete/);
    assert.deepEqual(mock.calls.delete, []);
    // The plan is still published even though apply was refused.
    assert.ok(r.outputs["plan-path"], "plan-path output must be set on confirm-delete abort");
  } finally {
    await mock.close();
  }
});

test("apply deletes eligible versions and writes the apply report", async () => {
  const mock = await startMockRegistry({
    pages: defaultPages(),
    mutatedPages: [[apiVersion(1, ["latest"], OLD), apiVersion(3, ["sha-def"], RECENT)]],
    mutateAfterListCalls: 2,
  });
  try {
    const r = await runAction(mock.url, {
      "INPUT_DRY-RUN": "false",
      "INPUT_CONFIRM-DELETE": "Tooark/demo",
      "INPUT_KEEP-LATEST": "0",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.outputs.deleted, "1");
    assert.equal(r.outputs.failed, "0");
    assert.deepEqual(mock.calls.delete, [2]);
    const report = JSON.parse(readFileSync(r.outputs["result-path"], "utf8"));
    assert.equal(report.validation, "passed");
    assert.deepEqual(report.results, [{ versionId: 2, digest: "sha256:2", outcome: "deleted" }]);
  } finally {
    await mock.close();
  }
});

test("apply aborts when inventory changes between plan and apply", async () => {
  const mock = await startMockRegistry({
    pages: defaultPages(),
    mutatedPages: [[apiVersion(1, ["latest"], OLD)]],
    mutateAfterListCalls: 1,
  });
  try {
    const r = await runAction(mock.url, {
      "INPUT_DRY-RUN": "false",
      "INPUT_CONFIRM-DELETE": "Tooark/demo",
      "INPUT_KEEP-LATEST": "0",
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ABORTED_INVENTORY_CHANGED/);
    assert.deepEqual(mock.calls.delete, []);
    // The plan outputs from the original evaluation must survive the abort.
    assert.ok(r.outputs["plan-path"], "plan-path output must be set on inventory abort");
    assert.equal(JSON.parse(readFileSync(r.outputs["plan-path"], "utf8")).planSha256, r.outputs["plan-sha256"]);
  } finally {
    await mock.close();
  }
});

test("post-apply validation fails when a protected version disappears", async () => {
  const mock = await startMockRegistry({
    pages: defaultPages(),
    mutatedPages: [[apiVersion(3, ["sha-def"], RECENT)]],
    mutateAfterListCalls: 2,
  });
  try {
    const r = await runAction(mock.url, {
      "INPUT_DRY-RUN": "false",
      "INPUT_CONFIRM-DELETE": "Tooark/demo",
      "INPUT_KEEP-LATEST": "0",
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /VALIDATION_FAILED/);
    const report = JSON.parse(readFileSync(r.outputs["result-path"], "utf8"));
    assert.equal(report.validation, "failed");
  } finally {
    await mock.close();
  }
});

test("404 during delete is counted as absent, not deleted", async () => {
  const mock = await startMockRegistry({
    pages: defaultPages(),
    deleteStatus: () => 404,
  });
  try {
    const r = await runAction(mock.url, {
      "INPUT_DRY-RUN": "false",
      "INPUT_CONFIRM-DELETE": "Tooark/demo",
      "INPUT_KEEP-LATEST": "0",
      "INPUT_VALIDATE-AFTER-CLEANUP": "false",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.outputs.deleted, "0");
    assert.equal(r.outputs.absent, "1");
  } finally {
    await mock.close();
  }
});

test("safety budget aborts with ABORTED_BUDGET_EXCEEDED", async () => {
  const mock = await startMockRegistry({ pages: defaultPages() });
  try {
    const r = await runAction(mock.url, { "INPUT_KEEP-LATEST": "0", "INPUT_MAX-DELETIONS": "0" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ABORTED_BUDGET_EXCEEDED/);
  } finally {
    await mock.close();
  }
});

test("budget abort still publishes the plan outputs and the plan file", async () => {
  const mock = await startMockRegistry({ pages: defaultPages() });
  try {
    const r = await runAction(mock.url, { "INPUT_KEEP-LATEST": "0", "INPUT_MAX-DELETIONS": "0" });
    assert.equal(r.status, 1);
    assert.equal(r.outputs.scanned, "3");
    assert.equal(r.outputs.eligible, "1");
    assert.ok(r.outputs["plan-path"], "plan-path output must be set on budget abort");
    const plan = JSON.parse(readFileSync(r.outputs["plan-path"], "utf8"));
    assert.equal(plan.planSha256, r.outputs["plan-sha256"]);
    assert.equal(plan.counts.eligible, 1);
    // Apply never started: apply outputs must not exist on abort.
    assert.equal(r.outputs.deleted, undefined);
    assert.equal(r.outputs["result-path"], undefined);
  } finally {
    await mock.close();
  }
});

test("multi-arch child is protected end to end and nothing is deleted", async () => {
  const mock = await startMockRegistry({
    pages: [
      [
        apiVersion(1, ["latest"], RECENT),
        // Old untagged child of the retained index: naively eligible.
        apiVersion(2, [], OLD),
      ],
    ],
    manifests: {
      "sha256:1": {
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: [{ digest: "sha256:2" }],
      },
    },
  });
  try {
    const r = await runAction(mock.url, {
      "INPUT_DRY-RUN": "false",
      "INPUT_CONFIRM-DELETE": "Tooark/demo",
      "INPUT_DELETE-UNTAGGED": "true",
      "INPUT_KEEP-LATEST": "0",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.outputs.eligible, "0");
    assert.equal(r.outputs.deleted, "0");
    assert.deepEqual(mock.calls.delete, []);
    const plan = JSON.parse(readFileSync(r.outputs["plan-path"], "utf8"));
    assert.equal(plan.decisions.find((d) => d.versionId === 2).reason, "PROTECTED_OCI_CHILD");
  } finally {
    await mock.close();
  }
});

test("registry failure fails closed instead of deleting untagged versions", async () => {
  const mock = await startMockRegistry({
    pages: [[apiVersion(1, ["latest"], RECENT), apiVersion(2, [], OLD)]],
    registryTokenStatus: 401,
  });
  try {
    const r = await runAction(mock.url, {
      "INPUT_DRY-RUN": "false",
      "INPUT_CONFIRM-DELETE": "Tooark/demo",
      "INPUT_DELETE-UNTAGGED": "true",
      "INPUT_KEEP-LATEST": "0",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.outputs.eligible, "0");
    assert.deepEqual(mock.calls.delete, []);
    assert.match(r.stdout, /OCI inspection incomplete/);
  } finally {
    await mock.close();
  }
});

test("fail-on-empty aborts with ABORTED_NO_MATCH", async () => {
  const mock = await startMockRegistry({ pages: [[]] });
  try {
    const r = await runAction(mock.url, { "INPUT_FAIL-ON-EMPTY": "true" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ABORTED_NO_MATCH/);
  } finally {
    await mock.close();
  }
});
