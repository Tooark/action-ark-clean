export async function pool(values, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, values.length) }, async () => {
        while (i < values.length) {
            const v = values[i++];
            if (v !== undefined)
                await fn(v);
        }
    }));
}
//# sourceMappingURL=concurrency.js.map