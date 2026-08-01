import assert from "node:assert/strict";
import test from "node:test";
import { deleteVersion, listVersions, resolveOwnerType } from "../dist/github.js";
import { apiVersion, startMockRegistry } from "./helpers/mock-registry.mjs";

// github.js reads GITHUB_API_URL per call, so each test just points it at its mock.
function loadGithub(apiUrl) {
  process.env.GITHUB_API_URL = apiUrl;
  return { deleteVersion, listVersions, resolveOwnerType };
}

const config = (overrides = {}) => ({
  token: "x",
  owner: "Tooark",
  ownerType: "organization",
  packageName: "demo",
  retryCount: 2,
  ...overrides,
});

test("listVersions follows pagination across pages", async () => {
  const mock = await startMockRegistry({
    pages: [[apiVersion(1, ["latest"], "2026-01-01T00:00:00Z")], [apiVersion(2, [], "2026-02-01T00:00:00Z")]],
  });
  try {
    const { listVersions } = loadGithub(mock.url);
    const versions = await listVersions(config());
    assert.equal(versions.length, 2);
    assert.deepEqual(versions[0].tags, ["latest"]);
    assert.deepEqual(versions[1].tags, []);
    assert.equal(mock.calls.list, 2);
  } finally {
    await mock.close();
  }
});

test("listVersions rejects duplicate version IDs", async () => {
  const dup = apiVersion(7, ["a"], "2026-01-01T00:00:00Z");
  const mock = await startMockRegistry({ pages: [[dup], [dup]] });
  try {
    const { listVersions } = loadGithub(mock.url);
    await assert.rejects(() => listVersions(config()), /Duplicate package version 7/);
  } finally {
    await mock.close();
  }
});

test("listVersions retries transient 503 and then succeeds", async () => {
  const mock = await startMockRegistry({
    pages: [[apiVersion(1, ["latest"], "2026-01-01T00:00:00Z")]],
    failList: 2,
  });
  try {
    const { listVersions } = loadGithub(mock.url);
    const versions = await listVersions(config({ retryCount: 3 }));
    assert.equal(versions.length, 1);
    assert.equal(mock.calls.listFailures, 2);
  } finally {
    await mock.close();
  }
});

test("secondary rate limit 403 with retry-after is retried", async () => {
  const mock = await startMockRegistry({
    pages: [[apiVersion(1, ["latest"], "2026-01-01T00:00:00Z")]],
    failList: 1,
    failStatus: 403,
    failHeaders: { "retry-after": "0", "x-ratelimit-remaining": "0" },
  });
  try {
    const { listVersions } = loadGithub(mock.url);
    const versions = await listVersions(config({ retryCount: 2 }));
    assert.equal(versions.length, 1);
    assert.equal(mock.calls.listFailures, 1);
  } finally {
    await mock.close();
  }
});

test("plain 403 without rate-limit signals is not retried", async () => {
  const mock = await startMockRegistry({
    pages: [[apiVersion(1, ["latest"], "2026-01-01T00:00:00Z")]],
    failList: 1,
    failStatus: 403,
  });
  try {
    const { listVersions } = loadGithub(mock.url);
    await assert.rejects(() => listVersions(config({ retryCount: 3 })), /HTTP 403/);
  } finally {
    await mock.close();
  }
});

test("listVersions fails after retries are exhausted", async () => {
  const mock = await startMockRegistry({
    pages: [[apiVersion(1, ["latest"], "2026-01-01T00:00:00Z")]],
    failList: 99,
  });
  try {
    const { listVersions } = loadGithub(mock.url);
    await assert.rejects(() => listVersions(config({ retryCount: 1 })), /HTTP 503/);
  } finally {
    await mock.close();
  }
});

test("resolveOwnerType maps API owner types and honors explicit values", async () => {
  const mock = await startMockRegistry({ ownerType: "User" });
  try {
    const { resolveOwnerType } = loadGithub(mock.url);
    assert.equal(await resolveOwnerType(config({ ownerType: "auto" })), "user");
    assert.equal(await resolveOwnerType(config({ ownerType: "organization" })), "organization");
    assert.equal(mock.calls.users, 1);
  } finally {
    await mock.close();
  }
});

test("deleteVersion maps 204, 404, and other statuses", async () => {
  const mock = await startMockRegistry({
    deleteStatus: (id) => (id === 1 ? 204 : id === 2 ? 404 : 500),
  });
  try {
    const { deleteVersion } = loadGithub(mock.url);
    assert.equal(await deleteVersion(config(), 1), "deleted");
    assert.equal(await deleteVersion(config(), 2), "absent");
    await assert.rejects(() => deleteVersion(config({ retryCount: 0 }), 3), /HTTP 500/);
    assert.deepEqual(mock.calls.delete, [1, 2, 3]);
  } finally {
    await mock.close();
  }
});

test("user owner type routes through /users endpoints", async () => {
  const mock = await startMockRegistry({
    pages: [[apiVersion(1, ["latest"], "2026-01-01T00:00:00Z")]],
  });
  try {
    const { listVersions } = loadGithub(mock.url);
    const versions = await listVersions(config({ ownerType: "user" }));
    assert.equal(versions.length, 1);
  } finally {
    await mock.close();
  }
});
