import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Lê o arquivo package.json e analisa seu conteúdo como um objeto JavaScript.
const pkg = JSON.parse(await readFile("package.json", "utf8"));

/**
 * Função assíncrona que gera uma lista de componentes do bundle, incluindo arquivos JavaScript na pasta "dist" e suas hashes SHA-256.
 * @returns {Promise<Array>} Uma promessa que resolve para uma lista de objetos representando os componentes do bundle.
 */
async function bundleComponents() {
  // Lê os arquivos na pasta "dist" e filtra apenas os arquivos JavaScript.
  const files = (await readdir("dist")).filter((f) => f.endsWith(".js"));
  const components = [];

  // Itera sobre os arquivos JavaScript encontrados na pasta "dist".
  for (const file of files.sort()) {
    // Lê o conteúdo do arquivo.
    const content = await readFile(join("dist", file));

    // Adiciona um objeto representando o componente do arquivo à lista de componentes e calcula sua hash SHA-256.
    components.push({
      type: "file",
      name: `dist/${file}`,
      hashes: [{ alg: "SHA-256", content: createHash("sha256").update(content).digest("hex") }],
    });
  }

  return components;
}

// Gera o SBOM (Software Bill of Materials) no formato CycloneDX 1.5, incluindo metadados sobre o pacote,
// componentes do bundle e dependências de desenvolvimento.
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
      purl: `pkg:npm/${name.replaceAll("@", "%40")}@${version}`,
    })),
  ],
};

// Emite o SBOM gerado no formato JSON para a saída padrão, com indentação de 2 espaços.
process.stdout.write(`${JSON.stringify(sbom, null, 2)}\n`);
