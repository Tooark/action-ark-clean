import type { Config, OciEvidence, PackageVersion } from "./types.js";
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
export declare function gatherOciEvidence(c: Config, versions: PackageVersion[]): Promise<OciEvidence>;
/**
 * Confirma quais digests estão realmente ausentes do registry: apenas um HTTP
 * 404 explícito no manifest conta como prova de ausência. Qualquer outra
 * resposta ou falha (rede, autenticação, 5xx) deixa o digest de fora do
 * resultado — na dúvida, o referrer correspondente permanece retido.
 * @param c Configuração com token do GitHub, owner e packageName.
 * @param digests Digests de subjects a verificar.
 * @returns Conjunto dos digests comprovadamente ausentes (404).
 */
export declare function confirmAbsent(c: Config, digests: Iterable<string>): Promise<Set<string>>;
