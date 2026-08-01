import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { info, input, mask, output, save, summary, warning } from "../dist/io.js";

function captureLog(fn) {
  const lines = [];
  const original = console.log;
  console.log = (msg) => lines.push(String(msg));
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

test("input trims values and enforces required", () => {
  process.env.INPUT_SAMPLE = "  value  ";
  try {
    assert.equal(input("sample"), "value");
    assert.equal(input("absent"), "");
    assert.throws(() => input("absent", true), /Missing required input: absent/);
  } finally {
    delete process.env.INPUT_SAMPLE;
  }
});

test("mask emits the add-mask command only for non-empty values", () => {
  const writes = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => writes.push(String(chunk));
  try {
    mask("secret");
    mask("");
  } finally {
    process.stdout.write = original;
  }
  assert.deepEqual(writes, ["::add-mask::secret\n"]);
});

test("info and warning strip CR/LF to prevent workflow-command forgery", () => {
  const lines = captureLog(() => {
    info("line1\nline2\r\nline3");
    warning("warn\n::error::forged");
  });
  assert.deepEqual(lines, ["line1 line2 line3", "::warning::warn ::error::forged"]);
});

test("output falls back to the console outside the runner", async () => {
  const saved = process.env.GITHUB_OUTPUT;
  delete process.env.GITHUB_OUTPUT;
  try {
    const lines = [];
    const original = console.log;
    console.log = (msg) => lines.push(String(msg));
    try {
      await output("scanned", 7);
    } finally {
      console.log = original;
    }
    assert.deepEqual(lines, ["OUTPUT scanned=7"]);
  } finally {
    if (saved !== undefined) process.env.GITHUB_OUTPUT = saved;
  }
});

test("output writes the heredoc format when GITHUB_OUTPUT is set", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "arklean-io-")), "out.txt");
  const saved = process.env.GITHUB_OUTPUT;
  process.env.GITHUB_OUTPUT = file;
  try {
    await output("plan-path", "/tmp/plan.json");
    assert.equal(readFileSync(file, "utf8"), "plan-path<<ARKLEAN_EOF\n/tmp/plan.json\nARKLEAN_EOF\n");
  } finally {
    if (saved !== undefined) process.env.GITHUB_OUTPUT = saved;
    else delete process.env.GITHUB_OUTPUT;
  }
});

test("summary writes only when GITHUB_STEP_SUMMARY is set", async () => {
  const saved = process.env.GITHUB_STEP_SUMMARY;
  delete process.env.GITHUB_STEP_SUMMARY;
  try {
    await summary("## ignored\n");

    const file = join(mkdtempSync(join(tmpdir(), "arklean-io-")), "summary.md");
    process.env.GITHUB_STEP_SUMMARY = file;
    await summary("## written\n");
    assert.equal(readFileSync(file, "utf8"), "## written\n");
  } finally {
    if (saved !== undefined) process.env.GITHUB_STEP_SUMMARY = saved;
    else delete process.env.GITHUB_STEP_SUMMARY;
  }
});

test("save persists UTF-8 content", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "arklean-io-")), "audit.json");
  await save(file, '{"ok":true}');
  assert.equal(readFileSync(file, "utf8"), '{"ok":true}');
  assert.ok(statSync(file).isFile());
});
