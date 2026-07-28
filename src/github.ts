import type { Config, OwnerType, PackageVersion, ResolvedConfig } from "./types.js";

const API = process.env.GITHUB_API_URL || "https://api.github.com";

function base(c: ResolvedConfig): string {
  const owner =
    c.ownerType === "organization" ? `orgs/${encodeURIComponent(c.owner)}` : `users/${encodeURIComponent(c.owner)}`;
  return `${API}/${owner}/packages/container/${encodeURIComponent(c.packageName)}/versions`;
}

function headers(c: Config): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${c.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Tooark-Arklean",
  };
}

// GitHub signals secondary rate limits with 403 plus Retry-After or an exhausted quota.
function transient(r: Response): boolean {
  if ([429, 502, 503, 504].includes(r.status)) return true;
  return r.status === 403 && (r.headers.has("retry-after") || r.headers.get("x-ratelimit-remaining") === "0");
}

async function request(c: Config, url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const r = await fetch(url, {
    ...init,
    headers: { ...headers(c), ...(init.headers || {}) },
  });
  if (transient(r) && attempt < c.retryCount) {
    const retryAfter = Number(r.headers.get("retry-after") || 0) * 1000;
    const wait = retryAfter || Math.min(30000, 500 * 2 ** attempt + Math.floor(Math.random() * 250));
    await new Promise((x) => setTimeout(x, wait));
    return request(c, url, init, attempt + 1);
  }
  return r;
}

export async function resolveOwnerType(c: Config): Promise<OwnerType> {
  if (c.ownerType !== "auto") return c.ownerType;
  const r = await request(c, `${API}/users/${encodeURIComponent(c.owner)}`);
  if (!r.ok) throw new Error(`GitHub API owner lookup failed with HTTP ${r.status}`);
  const data = (await r.json()) as { type?: string };
  if (data.type === "Organization") return "organization";
  if (data.type === "User") return "user";
  throw new Error(`Unable to determine owner type for ${c.owner}`);
}

export async function listVersions(c: ResolvedConfig): Promise<PackageVersion[]> {
  const all: PackageVersion[] = [];
  const seen = new Set<number>();
  let url: string | undefined = `${base(c)}?per_page=100`;
  for (let page = 1; url && page <= 1000; page++) {
    const r = await request(c, url);
    if (!r.ok) throw new Error(`GitHub API list failed with HTTP ${r.status}`);
    const data = (await r.json()) as Array<{
      id: number;
      name: string;
      created_at: string;
      updated_at: string;
      metadata?: { container?: { tags?: string[] } };
    }>;
    for (const v of data) {
      if (seen.has(v.id)) throw new Error(`Duplicate package version ${v.id}; refusing ambiguous inventory`);
      seen.add(v.id);
      all.push({
        id: v.id,
        name: v.name,
        tags: v.metadata?.container?.tags ?? [],
        createdAt: v.created_at,
        updatedAt: v.updated_at,
      });
    }
    const link = r.headers.get("link") ?? "";
    const next = link
      .split(",")
      .map((x) => x.trim())
      .find((x) => x.endsWith('rel="next"'));
    const match = next?.match(/^<([^>]+)>/);
    url = match?.[1];
  }
  if (url) throw new Error("Pagination exceeded 1000 pages; refusing incomplete inventory");
  return all;
}

export async function deleteVersion(c: ResolvedConfig, id: number): Promise<"deleted" | "absent"> {
  const r = await request(c, `${base(c)}/${id}`, { method: "DELETE" });
  if (r.status === 204) return "deleted";
  if (r.status === 404) return "absent";
  throw new Error(`GitHub API delete failed for version ${id} with HTTP ${r.status}`);
}
