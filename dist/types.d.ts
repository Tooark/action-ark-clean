/**
 * =============================================================================
 * Types
 * =============================================================================
 */
/**
 * Tipo de proprietário do pacote, que pode ser uma organização ou um usuário.
 * Decide o roteamento das chamadas à API de packages (`/orgs/{owner}/...` ou `/users/{owner}/...`).
 */
export type OwnerType = "organization" | "user";
/**
 * Regra de correspondência de tags: correspondência exata ou
 * expressão regular (linhas delimitadas por `/.../` nos inputs). O mesmo tipo serve às duas listas de regras:
 * em `protected-tags` a correspondência retém a versão; em `ephemeral-tags` ela a torna candidata por idade.
 *
 * `value` preserva a linha original do input (incluindo as barras da regex) e é o que aparece como evidência
 * em `matchedRule` e no fingerprint da política; `regex` é compilada uma única vez, após validação.
 */
export type Rule = {
    kind: "exact";
    value: string;
} | {
    kind: "regex";
    value: string;
    regex: RegExp;
};
/**
 * Configuração com o tipo de proprietário já resolvido (`auto` substituído pelo valor real
 * obtido na API do GitHub). É o tipo exigido pelas operações que montam URLs por proprietário.
 */
export type ResolvedConfig = Config & {
    ownerType: OwnerType;
};
/**
 * Motivo estável e legível por máquina de cada decisão do plano.
 *
 * Códigos `PROTECTED_*` retêm a versão; códigos `ELIGIBLE_*` a tornam candidata à exclusão:
 * - `PROTECTED_TAG`: uma tag da versão casa com uma regra de `protected-tags`.
 * - `PROTECTED_NEWEST`: preservada por `always-keep-newest`.
 * - `PROTECTED_KEEP_LATEST`: entre as N candidatas tagueadas mais recentes (`keep-latest`).
 * - `PROTECTED_TOO_RECENT`: mais nova que a retenção mínima aplicável.
 * - `PROTECTED_UNMATCHED_TAG`: tagueada, mas sem correspondência com nenhuma regra efêmera.
 * - `PROTECTED_OCI_CHILD`: filho de plataforma de um índice multi-arch retido.
 * - `PROTECTED_OCI_REFERRER`: referrer (assinatura/atestado/SBOM) de uma versão retida.
 * - `PROTECTED_UNKNOWN_RELATION`: relação OCI não comprovável; falha fechado.
 * - `DEFERRED_BUDGET`: candidata excedente aos orçamentos com `budget-mode: cap`; retida nesta execução,
 *   volta a ser candidata nas próximas (não é garantia de retenção).
 * - `ELIGIBLE_EPHEMERAL`: tag efêmera mais antiga que `ephemeral-retention-days`.
 * - `ELIGIBLE_UNTAGGED`: sem tags e mais antiga que `untagged-retention-days`, com `delete-untagged` habilitado.
 * - `ELIGIBLE_ORPHAN_REFERRER`: referrer cujo subject está comprovadamente ausente (fora do inventário e
 *   confirmado 404 no registry), com `delete-orphaned-referrers` habilitado.
 */
export type Reason = "PROTECTED_TAG" | "PROTECTED_NEWEST" | "PROTECTED_KEEP_LATEST" | "PROTECTED_TOO_RECENT" | "PROTECTED_UNMATCHED_TAG" | "PROTECTED_OCI_CHILD" | "PROTECTED_OCI_REFERRER" | "PROTECTED_UNKNOWN_RELATION" | "DEFERRED_BUDGET" | "ELIGIBLE_EPHEMERAL" | "ELIGIBLE_UNTAGGED" | "ELIGIBLE_ORPHAN_REFERRER";
/**
 * Desfecho de uma tentativa de exclusão no modo apply:
 * `deleted` (HTTP 204), `absent` (HTTP 404, sucesso idempotente) ou `failed` (qualquer outro status).
 */
export type ApplyOutcome = "deleted" | "absent" | "failed";
/**
 * =============================================================================
 * Interfaces
 * =============================================================================
 */
/**
 * Configuração completa da action, carregada e validada a partir dos inputs
 * (`INPUT_*`) antes de qualquer acesso à rede. Espelha o contrato público da action.
 */
export interface Config {
    /** Token do GitHub usado exclusivamente para chamadas à API; mascarado nos logs imediatamente após a leitura. */
    token: string;
    /** Organização ou usuário proprietário do pacote GHCR. */
    owner: string;
    /** Tipo do proprietário; `auto` é resolvido pela API do GitHub antes do uso (ver {@link ResolvedConfig}). */
    ownerType: OwnerType | "auto";
    /** Nome exato do pacote `container` no GHCR. */
    packageName: string;
    /** Regras de proteção: qualquer tag correspondente retém a versão inteira. */
    protectedRules: Rule[];
    /** Regras efêmeras: versões tagueadas correspondentes tornam-se candidatas por idade. */
    ephemeralRules: Rule[];
    /** Idade mínima, em dias, para versões com tag efêmera serem candidatas. */
    ephemeralDays: number;
    /** Idade mínima, em dias, para versões sem tag serem candidatas. */
    untaggedDays: number;
    /** Quantidade das candidatas tagueadas mais recentes a preservar (`PROTECTED_KEEP_LATEST`). */
    keepLatest: number;
    /** Permite excluir versões antigas sem tag; desabilitado por padrão. */
    deleteUntagged: boolean;
    /** Preserva sempre a versão mais recente do pacote (`PROTECTED_NEWEST`). */
    alwaysKeepNewest: boolean;
    /** Protege filhos de plataforma de índices multi-arch retidos via manifests do registry. */
    protectMultiArch: boolean;
    /** Protege referrers (assinaturas, atestados, SBOMs) de versões retidas. */
    protectReferrers: boolean;
    /**
     * Permite excluir referrers cujo subject está comprovadamente ausente: fora do
     * inventário E confirmado 404 no registry. Fail-closed; desabilitado por padrão.
     */
    deleteOrphanedReferrers: boolean;
    /** Modo somente-plano: nenhuma requisição DELETE é enviada. Padrão `true`. */
    dryRun: boolean;
    /** Confirmação obrigatória no modo apply; deve ser exatamente `owner/package`. */
    confirmDelete: string;
    /** Falha a execução quando o pacote não possui versões (`ABORTED_NO_MATCH`). */
    failOnEmpty: boolean;
    /** Relê o inventário antes do primeiro DELETE e aborta se houver mudança (`ABORTED_INVENTORY_CHANGED`). */
    verifyInventoryBeforeApply: boolean;
    /** Relê o inventário após o apply e falha se alguma versão protegida sumiu (`VALIDATION_FAILED`). */
    validateAfterCleanup: boolean;
    /** Limite absoluto de exclusões por execução (`ABORTED_BUDGET_EXCEEDED`). */
    maxDeletions: number;
    /** Limite percentual de exclusões sobre o total escaneado (`ABORTED_BUDGET_EXCEEDED`). */
    maxDeletePercentage: number;
    /**
     * Comportamento quando o plano excede um orçamento: `abort` (padrão) falha a execução;
     * `cap` mantém como elegíveis as candidatas mais antigas que cabem nos dois orçamentos
     * e adia o restante (`DEFERRED_BUDGET`) para execuções futuras.
     */
    budgetMode: "abort" | "cap";
    /** Número de requisições DELETE concorrentes (1 a 10). */
    concurrency: number;
    /** Tentativas extras para falhas transitórias da API (0 a 5). */
    retryCount: number;
}
/**
 * Versão de pacote GHCR normalizada a partir da resposta da API do GitHub.
 * A versão de pacote é a unidade de exclusão.
 */
export interface PackageVersion {
    /** ID numérico da versão na API de packages; usado nas requisições DELETE. */
    id: number;
    /** Digest OCI da versão (campo `name` da API), no formato `sha256:<hex>`. */
    name: string;
    /** Conjunto completo de tags da versão; vazio para versões untagged. */
    tags: string[];
    /** Instante de criação (ISO 8601); base para os cálculos de idade. */
    createdAt: string;
    /** Instante da última atualização (ISO 8601). */
    updatedAt: string;
}
/**
 * Decisão final e auditável do plano para uma única versão de pacote.
 * Cada versão recebe exatamente uma disposição (invariante do modelo de domínio).
 */
export interface Decision {
    /** ID da versão avaliada. */
    versionId: number;
    /** Digest OCI da versão avaliada. */
    digest: string;
    /** Tags da versão, ordenadas para garantir determinismo do plano. */
    tags: string[];
    /** Instante de criação da versão (ISO 8601). */
    createdAt: string;
    /** Disposição final: retida (`protected`) ou candidata à exclusão (`eligible`). */
    disposition: "protected" | "eligible";
    /** Código estável do motivo da disposição. */
    reason: Reason;
    /** Evidência da decisão: a regra que casou ou, nas proteções OCI, o digest do pai/subject relacionado. */
    matchedRule?: string;
}
/**
 * Plano de limpeza canônico e determinístico, gravado em JSON (`plan-path`)
 * em toda execução. Mesmo inventário, política e relógio produzem sempre o mesmo plano (NFR-007).
 */
export interface Plan {
    /** Versão do schema do plano; incrementada apenas com notas de migração. */
    schemaVersion: 1;
    /** Proprietário do pacote avaliado. */
    owner: string;
    /** Tipo do proprietário já resolvido. */
    ownerType: OwnerType;
    /** Nome do pacote avaliado. */
    package: string;
    /** Instante da avaliação (ISO 8601); injetado para manter o motor de política determinístico. */
    evaluatedAt: string;
    /** SHA-256 do inventário normalizado; usado no recheck pré-apply contra corridas TOCTOU. */
    inventoryFingerprint: string;
    /** SHA-256 da política efetiva aplicada. */
    policyFingerprint: string;
    /** Decisões por versão, ordenadas por `versionId`. */
    decisions: Decision[];
    /** Contadores agregados; `scanned` = `protected` + `eligible`. */
    counts: {
        scanned: number;
        protected: number;
        eligible: number;
    };
}
/**
 * Evidência coletada dos manifests do registry para propagar proteção OCI.
 * Digests cujo manifest não pôde ser inspecionado entram em `unknown` e falham fechado
 * (`PROTECTED_UNKNOWN_RELATION`).
 */
export interface OciEvidence {
    /** Mapa de digest do índice retido para os digests dos seus filhos de plataforma. */
    children: Map<string, string[]>;
    /** Mapa de digest do referrer para o digest do subject apontado (campo `subject` do OCI 1.1). */
    subjects: Map<string, string>;
    /** Digests cujo manifest não pôde ser inspecionado (falha de rede, autenticação ou HTTP não-2xx). */
    unknown: Set<string>;
    /**
     * Tamanho estimado por digest, em bytes, somado do config e das layers do manifest
     * (ou dos descritores filhos, para índices). Base do output `estimated-reclaimed-bytes`.
     */
    sizes: Map<string, number>;
}
/**
 * Desfecho de uma tentativa de exclusão registrado no relatório de apply.
 */
export interface ApplyResult {
    /** ID da versão cuja exclusão foi tentada. */
    versionId: number;
    /** Digest OCI da versão cuja exclusão foi tentada. */
    digest: string;
    /** Desfecho da tentativa. */
    outcome: ApplyOutcome;
    /** Mensagem de erro redigida, presente apenas quando `outcome` é `failed`. */
    error?: string;
}
/**
 * Relatório auditável do apply, gravado em JSON (`result-path`) apenas no
 * modo apply; em dry-run o output `result-path` é vazio.
 */
export interface ApplyReport {
    /** Versão do schema do relatório; incrementada apenas com notas de migração. */
    schemaVersion: 1;
    /** Proprietário do pacote processado. */
    owner: string;
    /** Nome do pacote processado. */
    package: string;
    /** SHA-256 do plano que originou este apply, para correlação entre os dois artefatos. */
    planSha256: string;
    /** Instante de início das exclusões (ISO 8601). */
    startedAt: string;
    /** Instante de término, após a validação pós-apply (ISO 8601). */
    finishedAt: string;
    /** Desfecho por tentativa de exclusão, ordenado por `versionId`. */
    results: ApplyResult[];
    /** Contadores agregados por desfecho. */
    counts: {
        deleted: number;
        absent: number;
        failed: number;
    };
    /** Resultado da validação pós-apply; `skipped` quando `validate-after-cleanup` está desabilitado. */
    validation: "passed" | "failed" | "skipped";
}
