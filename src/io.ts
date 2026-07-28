import { appendFile, writeFile } from "node:fs/promises";

export function input(name: string, required = false): string {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  const v = process.env[key]?.trim() ?? "";
  if (required && !v) throw new Error(`Missing required input: ${name}`);
  return v;
}

export function mask(value: string): void {
  if (value) process.stdout.write(`::add-mask::${value}\n`);
}

export function info(message: string): void {
  console.log(message.replace(/[\r\n]+/g, " "));
}

export function warning(message: string): void {
  console.log(`::warning::${message.replace(/[\r\n]+/g, " ")}`);
}

export function fail(message: string): void {
  process.exitCode = 1;
  console.error(`::error::${message.replace(/[\r\n]+/g, " ")}`);
}

export async function output(name: string, value: string | number): Promise<void> {
  const f = process.env.GITHUB_OUTPUT;
  if (f) await appendFile(f, `${name}<<ARKLEAN_EOF\n${value}\nARKLEAN_EOF\n`);
  else console.log(`OUTPUT ${name}=${value}`);
}

export async function summary(markdown: string): Promise<void> {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) await appendFile(f, markdown);
}

export async function save(path: string, data: string): Promise<void> {
  await writeFile(path, data, { encoding: "utf8", mode: 0o600 });
}
