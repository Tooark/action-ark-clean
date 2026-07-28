import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Backlog A4: the policy core must stay pure — no transport or environment
// imports. Enforced structurally by inspecting import statements.
const src = (name) => readFileSync(join(import.meta.dirname, "..", "src", name), "utf8");

const importsOf = (code) => [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);

test("policy imports no transport or environment modules", () => {
  const imports = importsOf(src("policy.ts"));
  for (const banned of ["./github.js", "./io.js", "./main.js", "./config.js"])
    assert.ok(!imports.includes(banned), `policy.ts must not import ${banned}`);
});

test("types imports nothing from the application", () => {
  assert.deepEqual(importsOf(src("types.ts")), []);
});

test("config imports no transport modules", () => {
  const imports = importsOf(src("config.ts"));
  assert.ok(!imports.includes("./github.js"), "config.ts must not import github.js");
});

test("github imports no environment modules", () => {
  const imports = importsOf(src("github.ts"));
  assert.ok(!imports.includes("./io.js"), "github.ts must not import io.js");
});

test("oci imports no environment or GitHub API modules", () => {
  const imports = importsOf(src("oci.ts"));
  for (const banned of ["./io.js", "./github.js", "./policy.js"])
    assert.ok(!imports.includes(banned), `oci.ts must not import ${banned}`);
});

test("only main composes the application", () => {
  const imports = importsOf(src("main.ts"));
  for (const expected of ["./config.js", "./github.js", "./io.js", "./policy.js"])
    assert.ok(imports.includes(expected), `main.ts should import ${expected}`);
});
