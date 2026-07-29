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
 * Aborta com `ABORTED_BUDGET_EXCEEDED` quando o plano excede o limite absoluto
 * (`max-deletions`) ou percentual (`max-delete-percentage`) de exclusões.
 * @param config Configuração com limites de exclusão.
 * @param plan Plano de limpeza a ser avaliado.
 * @throws Erro se o plano exceder algum limite.
 */
export declare function assertBudget(config: Config, plan: Plan): void;
