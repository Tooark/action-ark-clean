import { pool } from "./concurrency.js";
/**
 * ARKLEAN_REGISTRY_URL é um hook de teste; produção sempre fala com ghcr.io.
 */
const REGISTRY = process.env.ARKLEAN_REGISTRY_URL || "https://ghcr.io";
/**
 * Lista de tipos MIME aceitos para manifests OCI e Docker.
 */
const MANIFEST_ACCEPT = [
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");
/**
 * `fetch` com retry para falhas transitórias (429/502/503/504), respeitando `Retry-After`.
 * @param url URL do endpoint a ser chamado.
 * @param init Opções de requisição HTTP (método, cabeçalhos, corpo, etc.).
 * @param retryCount Número máximo de tentativas de retry.
 * @param attempt Contador de tentativas (inicialmente 0).
 * @returns Resposta HTTP do endpoint.
 * @throws Erro se a requisição falhar permanentemente ou exceder o número de tentativas.
 */
async function fetchRetry(url, init, retryCount, attempt = 0) {
    const r = await fetch(url, init);
    if ([429, 502, 503, 504].includes(r.status) && attempt < retryCount) {
        const retryAfter = Number(r.headers.get("retry-after") || 0) * 1000;
        const wait = retryAfter || Math.min(30000, 500 * 2 ** attempt + Math.floor(Math.random() * 250));
        await new Promise((x) => setTimeout(x, wait));
        return fetchRetry(url, init, retryCount, attempt + 1);
    }
    return r;
}
/**
 * O registry exige o nome do repositório em lowercase, mesmo quando o owner tem maiúsculas.
 * @param c Configuração com owner e packageName.
 * @returns Nome do repositório no formato `owner/packageName` em lowercase.
 */
function repository(c) {
    return `${c.owner}/${c.packageName}`.toLowerCase();
}
/**
 * Troca o token do GitHub por um Bearer token do registry com escopo restrito
 * a `pull` no único pacote inspecionado.
 * @param c Configuração com token do GitHub, owner e packageName.
 * @returns Bearer token do registry para o pacote.
 * @throws Erro se a troca falhar ou não retornar token.
 */
async function registryToken(c) {
    const basic = Buffer.from(`x:${c.token}`).toString("base64");
    const r = await fetchRetry(`${REGISTRY}/token?service=ghcr.io&scope=repository:${repository(c)}:pull`, { headers: { Authorization: `Basic ${basic}` } }, c.retryCount);
    if (!r.ok) {
        throw new Error(`Registry token exchange failed with HTTP ${r.status}`);
    }
    const data = (await r.json());
    if (!data.token) {
        throw new Error("Registry token exchange returned no token");
    }
    return data.token;
}
/**
 * Inspeciona o manifest de cada versão e coleta filhos de índices e subjects de
 * referrers.
 * @param c Configuração com token do GitHub, owner e packageName.
 * @param versions Lista de versões do pacote a inspecionar.
 * @returns Evidência de relações OCI: filhos de multi-arch e subjects de referrers.
 * @remarks Qualquer versão cujo manifest não puder ser lido entra em `unknown`
 * para que o motor de política falhe fechado — inclusive quando a própria troca
 * de token falha, caso em que todas as versões viram `unknown`.
 */
export async function gatherOciEvidence(c, versions) {
    const evidence = { children: new Map(), subjects: new Map(), unknown: new Set() };
    let token;
    try {
        token = await registryToken(c);
    }
    catch {
        for (const v of versions) {
            evidence.unknown.add(v.name);
        }
        return evidence;
    }
    await pool(versions, c.concurrency, async (v) => {
        try {
            const r = await fetchRetry(`${REGISTRY}/v2/${repository(c)}/manifests/${encodeURIComponent(v.name)}`, { headers: { Authorization: `Bearer ${token}`, Accept: MANIFEST_ACCEPT } }, c.retryCount);
            if (!r.ok) {
                evidence.unknown.add(v.name);
                return;
            }
            const manifest = (await r.json());
            if (Array.isArray(manifest.manifests)) {
                evidence.children.set(v.name, manifest.manifests.map((m) => m.digest).filter((d) => typeof d === "string"));
            }
            if (manifest.subject?.digest) {
                evidence.subjects.set(v.name, manifest.subject.digest);
            }
        }
        catch {
            evidence.unknown.add(v.name);
        }
    });
    return evidence;
}
//# sourceMappingURL=oci.js.map