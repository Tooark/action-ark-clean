import type { Config, OciEvidence, PackageVersion, Plan, ResolvedConfig } from "./types.js";
/**
 * Constrói o plano de limpeza: uma decisão auditável por versão, com reason code estável.
 * @param config Configuração resolvida com as regras e parâmetros de política.
 * @param versions Versões do pacote a avaliar.
 * @param now Relógio injetado para manter o motor determinístico (default: agora).
 * @returns Plano de limpeza completo, com decisões por versão e contadores agregados.
 */
export declare function buildPlan(config: ResolvedConfig, versions: PackageVersion[], now?: Date): Plan;
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
export declare function protectOciRelations(plan: Plan, evidence: OciEvidence, config: Pick<Config, "protectMultiArch" | "protectReferrers">): Plan;
/**
 * Calcula o SHA-256 do plano.
 * @param plan Plano de limpeza a ser hasheado.
 * @returns SHA-256 do JSON do plano.
 * @remarks Contrato de determinismo: o plano é sempre construído com a mesma ordem de chaves
 * e com decisões/tags/inventário ordenados, então o JSON.stringify é estável.
 */
export declare function planHash(plan: Plan): string;
/**
 * Subjects referenciados por retenções fracas que não existem no inventário do
 * pacote — os candidatos a confirmação de ausência no registry. Só esses digests
 * precisam de verificação antes de `releaseOrphanReferrers`.
 * @param plan Plano com as decisões correntes.
 * @param evidence Evidência OCI com os subjects conhecidos.
 * @returns Digests de subjects fora do inventário.
 */
export declare function unresolvedSubjects(plan: Plan, evidence: OciEvidence): Set<string>;
/**
 * Com `delete-orphaned-referrers`, torna elegíveis (`ELIGIBLE_ORPHAN_REFERRER`)
 * referrers cujos subjects estão comprovadamente ausentes: todos fora do
 * inventário E todos confirmados 404 no registry (dupla prova). Apenas retenções
 * fracas são liberadas; qualquer dúvida mantém a versão retida (fail-closed).
 * @param plan Plano com as decisões correntes.
 * @param evidence Evidência OCI com os subjects conhecidos.
 * @param confirmedAbsent Digests confirmados ausentes por `confirmAbsent`.
 * @param config Configuração com a flag `delete-orphaned-referrers`.
 * @returns Plano com os referrers órfãos liberados.
 */
export declare function releaseOrphanReferrers(plan: Plan, evidence: OciEvidence, confirmedAbsent: Set<string>, config: Pick<Config, "deleteOrphanedReferrers">): Plan;
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
export declare function capToBudget(config: Config, plan: Plan): Plan;
/**
 * Aborta com `ABORTED_BUDGET_EXCEEDED` quando o plano excede o limite absoluto
 * (`max-deletions`) ou percentual (`max-delete-percentage`) de exclusões.
 * @param config Configuração com limites de exclusão.
 * @param plan Plano de limpeza a ser avaliado.
 * @throws Erro se o plano exceder algum limite.
 */
export declare function assertBudget(config: Config, plan: Plan): void;
