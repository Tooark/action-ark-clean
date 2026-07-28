import type { Config, OciEvidence, PackageVersion } from "./types.js";
export declare function gatherOciEvidence(c: Config, versions: PackageVersion[]): Promise<OciEvidence>;
