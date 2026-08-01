import type { Config, OwnerType, PackageVersion, ResolvedConfig } from "./types.js";

/** Base da API do GitHub; lida por chamada para permitir override em testes. */
const api = (): string => process.env.GITHUB_API_URL || "https://api.github.com";

/**
 * Monta o endpoint de versões do pacote para o escopo do proprietário resolvido.
 * @param c Configuração resolvida com `ownerType` definido.
 * @returns URL do endpoint de versões do pacote.
 */
function base(c: ResolvedConfig): string {
  const encodedOwner = encodeURIComponent(c.owner);
  const owner = c.ownerType === "organization" ? `orgs/${encodedOwner}` : `users/${encodedOwner}`;

  return `${api()}/${owner}/packages/container/${encodeURIComponent(c.packageName)}/versions`;
}

/**
 * Cabeçalhos comuns exigidos pelas chamadas à API REST do GitHub.
 * @param c Configuração com token de autenticação.
 * @returns Objeto de cabeçalhos HTTP.
 */
function headers(c: Config): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${c.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Tooark-Arklean",
  };
}

/**
 * Determina se uma resposta HTTP da API do GitHub indica falha transitória (429/502/503/504 ou 403 com Retry-After).
 * @param r Resposta HTTP da API do GitHub.
 * @returns `true` se a resposta indica falha transitória; `false` caso contrário.
 * @remarks O GitHub sinaliza rate limit secundário com 403 mais Retry-After ou quota esgotada;
 * um 403 puro é erro de permissão e não deve ser re-tentado.
 */
function transient(r: Response): boolean {
  if ([429, 502, 503, 504].includes(r.status)) {
    return true;
  }
  return r.status === 403 && (r.headers.has("retry-after") || r.headers.get("x-ratelimit-remaining") === "0");
}

/**
 * Requisição autenticada à API do GitHub com retry/backoff limitado para falhas transitórias.
 * @param c Configuração com token de autenticação e contagem de retry.
 * @param url URL do endpoint da API do GitHub.
 * @param init Opções de requisição HTTP (método, cabeçalhos, corpo, etc.).
 * @param attempt Contador de tentativas (inicialmente 0).
 * @returns Resposta HTTP da API do GitHub.
 * @throws Erro se a requisição falhar permanentemente ou exceder o número de tentativas.
 */
async function request(c: Config, url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const r = await fetch(url, {
    ...init,
    headers: { ...headers(c), ...(init.headers || {}) },
  });

  if (transient(r) && attempt < c.retryCount) {
    // Respeita Retry-After quando informado; senão, backoff exponencial com jitter, teto de 30s.
    const retryAfter = Number(r.headers.get("retry-after") || 0) * 1000;
    const wait = retryAfter || Math.min(30000, 500 * 2 ** attempt + Math.floor(Math.random() * 250));
    await new Promise((x) => setTimeout(x, wait));
    return request(c, url, init, attempt + 1);
  }

  return r;
}

/**
 * Resolve `ownerType` quando o input é `auto`, consultando `/users/{owner}`
 * (o endpoint responde tanto para usuários quanto para organizações).
 * @param c Configuração com `ownerType` possivelmente definido como `auto`.
 * @returns `ownerType` resolvido como `user` ou `organization`.
 * @throws Erro se a API do GitHub falhar ou retornar tipo desconhecido.
 */
export async function resolveOwnerType(c: Config): Promise<OwnerType> {
  if (c.ownerType !== "auto") {
    return c.ownerType;
  }

  const r = await request(c, `${api()}/users/${encodeURIComponent(c.owner)}`);
  if (!r.ok) {
    throw new Error(`GitHub API owner lookup failed with HTTP ${r.status}`);
  }

  const data = (await r.json()) as { type?: string };
  if (data.type === "Organization") {
    return "organization";
  }
  if (data.type === "User") {
    return "user";
  }

  throw new Error(`Unable to determine owner type for ${c.owner}`);
}

/**
 * Lista todas as versões do pacote com paginação completa.
 * IDs duplicados ou paginação além de 1000 páginas abortam a execução:
 * um inventário ambíguo ou parcial não pode alimentar decisões de exclusão.
 * @param c Configuração com `ownerType` resolvido.
 * @returns Lista completa de versões do pacote.
 * @throws Erro se a API do GitHub falhar, retornar dados inválidos ou exceder limites.
 */
export async function listVersions(c: ResolvedConfig): Promise<PackageVersion[]> {
  const all: PackageVersion[] = [];
  const seen = new Set<number>();

  let url: string | undefined = `${base(c)}?per_page=100`;
  for (let page = 1; url && page <= 1000; page++) {
    const r = await request(c, url);
    if (!r.ok) {
      throw new Error(`GitHub API list failed with HTTP ${r.status}`);
    }

    const data = (await r.json()) as Array<{
      id: number;
      name: string;
      created_at: string;
      updated_at: string;
      metadata?: { container?: { tags?: string[] } };
    }>;

    for (const v of data) {
      if (seen.has(v.id)) {
        throw new Error(`Duplicate package version ${v.id}; refusing ambiguous inventory`);
      }
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

  if (url) {
    throw new Error("Pagination exceeded 1000 pages; refusing incomplete inventory");
  }

  return all;
}

/**
 * Exclui uma versão do pacote. Um 404 é normalizado como `absent` (sucesso
 * idempotente) e nunca contado como `deleted`.
 * @param c Configuração com `ownerType` resolvido.
 * @param id ID da versão a excluir.
 * @returns Resultado da exclusão: `deleted` ou `absent`.
 * @throws Erro se a API do GitHub falhar com qualquer outro status.
 */
export async function deleteVersion(c: ResolvedConfig, id: number): Promise<"deleted" | "absent"> {
  const r = await request(c, `${base(c)}/${id}`, { method: "DELETE" });
  if (r.status === 204) {
    return "deleted";
  }
  if (r.status === 404) {
    return "absent";
  }
  throw new Error(`GitHub API delete failed for version ${id} with HTTP ${r.status}`);
}
