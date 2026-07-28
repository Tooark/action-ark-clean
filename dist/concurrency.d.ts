export declare function pool<T>(values: T[], n: number, fn: (v: T) => Promise<void>): Promise<void>;
