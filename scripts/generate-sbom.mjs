import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Minimal CycloneDX 1.5 SBOM. Arklean has zero runtime dependencies (ADR-006),
// so the SBOM covers the action itself, its committed bundle files, and the
// pinned development toolchain.
const pkg = JSON.parse(await readFile("package.json", "utf8"));

async function bundleComponents() {
  const files = (await readdir("dist")).filter((f) => f.endsWith(".js"));
  const components = [];
  for (const file of files.sort()) {
    const content = await readFile(join("dist", file));
    components.push({
      type: "file",
      name: `dist/${file}`,
      hashes: [{ alg: "SHA-256", content: createHash("sha256").update(content).digest("hex") }],
    });
  }
  return components;
}

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: pkg.name,
      version: process.env.GITHUB_REF_NAME || pkg.version,
      licenses: [{ license: { id: "Apache-2.0" } }],
    },
  },
  components: [
    ...(await bundleComponents()),
    ...Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
      type: "library",
      scope: "excluded",
      name,
      version,
      purl: `pkg:npm/${name.replace("@", "%40")}@${version}`,
    })),
  ],
};

process.stdout.write(`${JSON.stringify(sbom, null, 2)}\n`);
