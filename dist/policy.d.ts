import type { Config, OciEvidence, PackageVersion, Plan, ResolvedConfig } from "./types.js";
export declare function buildPlan(c: ResolvedConfig, versions: PackageVersion[], now?: Date): Plan;
export declare function protectOciRelations(plan: Plan, evidence: OciEvidence, c: Pick<Config, "protectMultiArch" | "protectReferrers">): Plan;
export declare function planHash(plan: Plan): string;
export declare function assertBudget(c: Config, p: Plan): void;
