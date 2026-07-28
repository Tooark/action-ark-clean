export async function pool<T>(values: T[], n: number, fn: (v: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, values.length) }, async () => {
      while (i < values.length) {
        const v = values[i++];
        if (v !== undefined) await fn(v);
      }
    }),
  );
}
