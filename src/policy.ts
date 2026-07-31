import { createHash } from "node:crypto";
import type { Config, Decision, OciEvidence, PackageVersion, Plan, Reason, ResolvedConfig, Rule } from "./types.js";

/**
 * Tempo de um dia em milissegundos, usado para cálculos de idade de versões.
 */
const DAY = 86400000;

/**
 * Esquema de tag de assinatura Cosign: `sha256-<digest>` com sufixo opcional (`.sig`, `.att`, `.sbom`).
 */
const COSIGN_TAG = /^sha256-([0-9a-f]{64})(\..+)?$/;

const hash = (s: string): string => createHash("sha256").update(s).digest("hex");

/**
 * Retorna o valor da primeira regra que casa com qualquer uma das tags,
 * ou `undefined` quando nenhuma regra corresponde.
 * @param tags Lista de tags da versão.
 * @param rules Lista de regras de tag a avaliar.
 * @returns Valor da primeira regra correspondente, ou `undefined`.
 * @remarks Regras exatas têm precedência sobre regex; a ordem das regras é respeitada.
 */
function match(tags: string[], rules: Rule[]): string | undefined {
  for (const rule of rules) {
    for (const tag of tags) {
      if (rule.kind === "exact" ? tag === rule.value : rule.regex.test(tag)) {
        return rule.value;
      }
    }
  }
  return undefined;
}

/**
 * Constrói o plano de limpeza: uma decisão auditável por versão, com reason code estável.
 * @param config Configuração resolvida com as regras e parâmetros de política.
 * @param versions Versões do pacote a avaliar.
 * @param now Relógio injetado para manter o motor determinístico (default: agora).
 * @returns Plano de limpeza completo, com decisões por versão e contadores agregados.
 */
export function buildPlan(config: ResolvedConfig, versions: PackageVersion[], now = new Date()): Plan {
  const decisions: Decision[] = [];
  const otherwiseEligible: Decision[] = [];

  for (const version of versions) {
    const protectedRule = match(version.tags, config.protectedRules);
    if (protectedRule) {
      decisions.push({
        versionId: version.id,
        digest: version.name,
        tags: [...version.tags].sort(),
        createdAt: version.createdAt,
        disposition: "protected",
        reason: "PROTECTED_TAG",
        matchedRule: protectedRule,
      });
      continue;
    }

    const age = (now.getTime() - new Date(version.createdAt).getTime()) / DAY;

    if (version.tags.length === 0) {
      if (config.deleteUntagged && age >= config.untaggedDays)
        otherwiseEligible.push({
          versionId: version.id,
          digest: version.name,
          tags: [],
          createdAt: version.createdAt,
          disposition: "eligible",
          reason: "ELIGIBLE_UNTAGGED",
        });
      else
        decisions.push({
          versionId: version.id,
          digest: version.name,
          tags: [],
          createdAt: version.createdAt,
          disposition: "protected",
          reason: "PROTECTED_TOO_RECENT",
        });
      continue;
    }

    const ephemeral = match(version.tags, config.ephemeralRules);
    if (!ephemeral) {
      decisions.push({
        versionId: version.id,
        digest: version.name,
        tags: [...version.tags].sort(),
        createdAt: version.createdAt,
        disposition: "protected",
        reason: "PROTECTED_UNMATCHED_TAG",
      });
      continue;
    }

    if (age < config.ephemeralDays) {
      decisions.push({
        versionId: version.id,
        digest: version.name,
        tags: [...version.tags].sort(),
        createdAt: version.createdAt,
        disposition: "protected",
        reason: "PROTECTED_TOO_RECENT",
        matchedRule: ephemeral,
      });
      continue;
    }

    otherwiseEligible.push({
      versionId: version.id,
      digest: version.name,
      tags: [...version.tags].sort(),
      createdAt: version.createdAt,
      disposition: "eligible",
      reason: "ELIGIBLE_EPHEMERAL",
      matchedRule: ephemeral,
    });
  }

  // Desempate por versionId para que versões criadas no mesmo instante ordenem de forma estável.
  const tagged = otherwiseEligible
    .filter((x) => x.tags.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.versionId - a.versionId);
  const keepLatestIds = new Set(tagged.slice(0, config.keepLatest).map((x) => x.versionId));

  let newestId: number | undefined;
  if (config.alwaysKeepNewest && versions.length > 0) {
    const newest = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)[0];
    if (newest) {
      newestId = newest.id;
    }
  }

  for (const eligible of otherwiseEligible) {
    if (keepLatestIds.has(eligible.versionId))
      decisions.push({
        ...eligible,
        disposition: "protected",
        reason: "PROTECTED_KEEP_LATEST",
      });
    else {
      if (eligible.versionId === newestId) {
        decisions.push({
          ...eligible,
          disposition: "protected",
          reason: "PROTECTED_NEWEST",
        });
      } else {
        decisions.push(eligible);
      }
    }
  }

  decisions.sort((a, b) => a.versionId - b.versionId);

  const policy = {
    protected: config.protectedRules.map((x) => x.value),
    ephemeral: config.ephemeralRules.map((x) => x.value),
    ephemeralDays: config.ephemeralDays,
    untaggedDays: config.untaggedDays,
    keepLatest: config.keepLatest,
    deleteUntagged: config.deleteUntagged,
    alwaysKeepNewest: config.alwaysKeepNewest,
  };

  const inventory = versions
    .map((version) => ({
      id: version.id,
      name: version.name,
      tags: [...version.tags].sort(),
      createdAt: version.createdAt,
    }))
    .sort((a, b) => a.id - b.id);

  return {
    schemaVersion: 1,
    owner: config.owner,
    ownerType: config.ownerType,
    package: config.packageName,
    evaluatedAt: now.toISOString(),
    inventoryFingerprint: hash(JSON.stringify(inventory)),
    policyFingerprint: hash(JSON.stringify(policy)),
    decisions,
    counts: {
      scanned: decisions.length,
      protected: decisions.filter((x) => x.disposition === "protected").length,
      eligible: decisions.filter((x) => x.disposition === "eligible").length,
    },
  };
}

/**
 * Propaga proteção OCI a partir das versões retidas.
 * @param plan Plano de limpeza com decisões iniciais.
 * @param evidence Evidência de relações OCI: filhos de multi-arch e subjects de referrers.
 * @param config Configuração com flags de proteção de multi-arch e referrers.
 * @returns Plano atualizado com decisões protegidas propagadas a partir das relações OCI.
 * @remarks Filhos de índices multi-arch, subjects de referrers (campo `subject`
 * do OCI 1.1 e esquema de tag Cosign `sha256-<digest>.<sufixo>`) e relações
 * desconhecidas, que falham fechado (ADR-003/ADR-005). Itera até um ponto fixo
 * para que os próprios filhos de um referrer protegido também sejam retidos.
 */
export function protectOciRelations(
  plan: Plan,
  evidence: OciEvidence,
  config: Pick<Config, "protectMultiArch" | "protectReferrers">,
): Plan {
  if (!config.protectMultiArch && !config.protectReferrers) {
    return plan;
  }

  const decisions = plan.decisions.map((d) => ({ ...d }));

  let changed = true;
  while (changed) {
    changed = false;
    const retained = new Set(decisions.filter((d) => d.disposition === "protected").map((d) => d.digest));
    const retainedHasUnknown =
      config.protectMultiArch && decisions.some((d) => d.disposition === "protected" && evidence.unknown.has(d.digest));

    for (const decision of decisions) {
      if (decision.disposition !== "eligible") {
        continue;
      }

      let reason: Reason | undefined;
      let relatedTo: string | undefined;

      if (config.protectMultiArch) {
        for (const parent of retained) {
          if (evidence.children.get(parent)?.includes(decision.digest)) {
            reason = "PROTECTED_OCI_CHILD";
            relatedTo = parent;
            break;
          }
        }
      }

      if (!reason && config.protectReferrers) {
        const subject = evidence.subjects.get(decision.digest);
        if (subject && retained.has(subject)) {
          reason = "PROTECTED_OCI_REFERRER";
          relatedTo = subject;
        } else {
          for (const tag of decision.tags) {
            const m = tag.match(COSIGN_TAG);
            if (m && retained.has(`sha256:${m[1]}`)) {
              reason = "PROTECTED_OCI_REFERRER";
              relatedTo = `sha256:${m[1]}`;
              break;
            }
          }
        }
      }

      // Falha fechado: sem prova de que esta versão é segura de excluir.
      if (!reason && evidence.unknown.has(decision.digest)) {
        reason = "PROTECTED_UNKNOWN_RELATION";
      }

      // Se algum índice retido não pôde ser inspecionado, qualquer untagged pode ser filho dele.
      if (!reason && retainedHasUnknown && decision.tags.length === 0) {
        reason = "PROTECTED_UNKNOWN_RELATION";
      }

      if (reason) {
        decision.disposition = "protected";
        decision.reason = reason;
        if (relatedTo) {
          decision.matchedRule = relatedTo;
        }
        changed = true;
      }
    }
  }

  return {
    ...plan,
    decisions,
    counts: {
      scanned: decisions.length,
      protected: decisions.filter((x) => x.disposition === "protected").length,
      eligible: decisions.filter((x) => x.disposition === "eligible").length,
    },
  };
}

/**
 * Calcula o SHA-256 do plano.
 * @param plan Plano de limpeza a ser hasheado.
 * @returns SHA-256 do JSON do plano.
 * @remarks Contrato de determinismo: o plano é sempre construído com a mesma ordem de chaves
 * e com decisões/tags/inventário ordenados, então o JSON.stringify é estável.
 */
export function planHash(plan: Plan): string {
  return hash(JSON.stringify(plan));
}

/**
 * Em `budget-mode: cap`, adia candidatas excedentes em vez de abortar: mantém
 * como elegíveis as mais antigas que cabem nos dois orçamentos e reclassifica o
 * restante como `DEFERRED_BUDGET` — retidas nesta execução, candidatas nas
 * próximas. As mais antigas saem primeiro para que o backlog dreneie em ordem
 * de idade.
 * @param config Configuração com limites de exclusão.
 * @param plan Plano de limpeza a ser ajustado.
 * @returns Plano com excedentes adiados; satisfaz `assertBudget` por construção.
 */
export function capToBudget(config: Config, plan: Plan): Plan {
  const allowed = Math.max(
    0,
    Math.min(config.maxDeletions, Math.floor((config.maxDeletePercentage / 100) * plan.counts.scanned)),
  );
  if (plan.counts.eligible <= allowed) {
    return plan;
  }

  const oldestFirst = plan.decisions
    .filter((d) => d.disposition === "eligible")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.versionId - b.versionId);
  const kept = new Set(oldestFirst.slice(0, allowed).map((d) => d.versionId));

  // matchedRule é preservado nas adiadas: continua sendo a evidência de por que são candidatas.
  const decisions = plan.decisions.map((d) =>
    d.disposition === "eligible" && !kept.has(d.versionId)
      ? { ...d, disposition: "protected" as const, reason: "DEFERRED_BUDGET" as const }
      : { ...d },
  );

  return {
    ...plan,
    decisions,
    counts: {
      scanned: decisions.length,
      protected: decisions.filter((x) => x.disposition === "protected").length,
      eligible: decisions.filter((x) => x.disposition === "eligible").length,
    },
  };
}

/**
 * Aborta com `ABORTED_BUDGET_EXCEEDED` quando o plano excede o limite absoluto
 * (`max-deletions`) ou percentual (`max-delete-percentage`) de exclusões.
 * @param config Configuração com limites de exclusão.
 * @param plan Plano de limpeza a ser avaliado.
 * @throws Erro se o plano exceder algum limite.
 */
export function assertBudget(config: Config, plan: Plan): void {
  const eligibleCount = plan.counts.eligible;
  const pct = plan.counts.scanned === 0 ? 0 : (eligibleCount / plan.counts.scanned) * 100;

  if (eligibleCount > config.maxDeletions) {
    throw new Error(`ABORTED_BUDGET_EXCEEDED: ${eligibleCount} deletions > max-deletions ${config.maxDeletions}`);
  }
  if (pct > config.maxDeletePercentage) {
    throw new Error(
      `ABORTED_BUDGET_EXCEEDED: ${pct.toFixed(1)}% > max-delete-percentage ${config.maxDeletePercentage}%`,
    );
  }
}
