import { pool } from "./concurrency.js";
// ARKLEAN_REGISTRY_URL is a test hook; production always talks to ghcr.io.
const REGISTRY = process.env.ARKLEAN_REGISTRY_URL || "https://ghcr.io";
const MANIFEST_ACCEPT = [
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");
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
function repository(c) {
    return `${c.owner}/${c.packageName}`.toLowerCase();
}
async function registryToken(c) {
    const basic = Buffer.from(`x:${c.token}`).toString("base64");
    const r = await fetchRetry(`${REGISTRY}/token?service=ghcr.io&scope=repository:${repository(c)}:pull`, { headers: { Authorization: `Basic ${basic}` } }, c.retryCount);
    if (!r.ok)
        throw new Error(`Registry token exchange failed with HTTP ${r.status}`);
    const data = (await r.json());
    if (!data.token)
        throw new Error("Registry token exchange returned no token");
    return data.token;
}
// Inspect every version's manifest and collect index children and referrer
// subjects. Any version whose manifest cannot be inspected is reported as
// unknown so the policy engine can fail closed.
export async function gatherOciEvidence(c, versions) {
    const evidence = { children: new Map(), subjects: new Map(), unknown: new Set() };
    let token;
    try {
        token = await registryToken(c);
    }
    catch {
        for (const v of versions)
            evidence.unknown.add(v.name);
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
            if (Array.isArray(manifest.manifests))
                evidence.children.set(v.name, manifest.manifests.map((m) => m.digest).filter((d) => typeof d === "string"));
            if (manifest.subject?.digest)
                evidence.subjects.set(v.name, manifest.subject.digest);
        }
        catch {
            evidence.unknown.add(v.name);
        }
    });
    return evidence;
}
//# sourceMappingURL=oci.js.map