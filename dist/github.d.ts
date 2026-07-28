import type { Config, OwnerType, PackageVersion, ResolvedConfig } from "./types.js";
export declare function resolveOwnerType(c: Config): Promise<OwnerType>;
export declare function listVersions(c: ResolvedConfig): Promise<PackageVersion[]>;
export declare function deleteVersion(c: ResolvedConfig, id: number): Promise<"deleted" | "absent">;
