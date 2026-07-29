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
