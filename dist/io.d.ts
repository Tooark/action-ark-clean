export declare function input(name: string, required?: boolean): string;
export declare function mask(value: string): void;
export declare function info(message: string): void;
export declare function warning(message: string): void;
export declare function fail(message: string): void;
export declare function output(name: string, value: string | number): Promise<void>;
export declare function summary(markdown: string): Promise<void>;
export declare function save(path: string, data: string): Promise<void>;
