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
export async function pool(values, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, values.length) }, async () => {
        while (i < values.length) {
            const v = values[i++];
            if (v !== undefined) {
                await fn(v);
            }
        }
    }));
}
//# sourceMappingURL=concurrency.js.map