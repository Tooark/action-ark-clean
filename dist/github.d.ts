import type { Config, OwnerType, PackageVersion, ResolvedConfig } from "./types.js";
/**
 * Resolve `ownerType` quando o input é `auto`, consultando `/users/{owner}`
 * (o endpoint responde tanto para usuários quanto para organizações).
 * @param c Configuração com `ownerType` possivelmente definido como `auto`.
 * @returns `ownerType` resolvido como `user` ou `organization`.
 * @throws Erro se a API do GitHub falhar ou retornar tipo desconhecido.
 */
export declare function resolveOwnerType(c: Config): Promise<OwnerType>;
/**
 * Lista todas as versões do pacote com paginação completa.
 * IDs duplicados ou paginação além de 1000 páginas abortam a execução:
 * um inventário ambíguo ou parcial não pode alimentar decisões de exclusão.
 * @param c Configuração com `ownerType` resolvido.
 * @returns Lista completa de versões do pacote.
 * @throws Erro se a API do GitHub falhar, retornar dados inválidos ou exceder limites.
 */
export declare function listVersions(c: ResolvedConfig): Promise<PackageVersion[]>;
/**
 * Exclui uma versão do pacote. Um 404 é normalizado como `absent` (sucesso
 * idempotente) e nunca contado como `deleted`.
 * @param c Configuração com `ownerType` resolvido.
 * @param id ID da versão a excluir.
 * @returns Resultado da exclusão: `deleted` ou `absent`.
 * @throws Erro se a API do GitHub falhar com qualquer outro status.
 */
export declare function deleteVersion(c: ResolvedConfig, id: number): Promise<"deleted" | "absent">;
