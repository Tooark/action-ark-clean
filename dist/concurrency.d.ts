/**
 * Executa `fn` para cada item de `values` com no máximo `n` execuções simultâneas.
 * O índice compartilhado distribui o trabalho entre os workers; se `fn` rejeitar,
 * o `Promise.all` propaga o erro e o pool é interrompido (fail-fast).
 * @param values Valores a processar.
 * @param n Número máximo de workers simultâneos.
 * @param fn Função assíncrona a aplicar a cada valor.
 * @returns Promise resolvida quando todos os valores forem processados ou rejeitada
 * se algum `fn` falhar.
 */
export declare function pool<T>(values: T[], n: number, fn: (v: T) => Promise<void>): Promise<void>;
