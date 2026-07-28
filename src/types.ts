export type OwnerType = "organization" | "user";

export type Rule = { kind: "exact"; value: string } | { kind: "regex"; value: string; regex: RegExp };

export interface Config {
  token: string;
  owner: string;
  ownerType: OwnerType | "auto";
  packageName: string;
  protectedRules: Rule[];
  ephemeralRules: Rule[];
  ephemeralDays: number;
  untaggedDays: number;
  keepLatest: number;
  deleteUntagged: boolean;
  alwaysKeepNewest: boolean;
  protectMultiArch: boolean;
  protectReferrers: boolean;
  dryRun: boolean;
  confirmDelete: string;
  failOnEmpty: boolean;
  verifyInventoryBeforeApply: boolean;
  validateAfterCleanup: boolean;
  maxDeletions: number;
  maxDeletePercentage: number;
  concurrency: number;
  retryCount: number;
}

export type ResolvedConfig = Config & { ownerType: OwnerType };

export interface PackageVersion {
  id: number;
  name: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type Reason =
  | "PROTECTED_TAG"
  | "PROTECTED_NEWEST"
  | "PROTECTED_KEEP_LATEST"
  | "PROTECTED_TOO_RECENT"
  | "PROTECTED_UNMATCHED_TAG"
  | "PROTECTED_OCI_CHILD"
  | "PROTECTED_OCI_REFERRER"
  | "PROTECTED_UNKNOWN_RELATION"
  | "ELIGIBLE_EPHEMERAL"
  | "ELIGIBLE_UNTAGGED";

export interface Decision {
  versionId: number;
  digest: string;
  tags: string[];
  createdAt: string;
  disposition: "protected" | "eligible";
  reason: Reason;
  matchedRule?: string;
}

export interface Plan {
  schemaVersion: 1;
  owner: string;
  ownerType: OwnerType;
  package: string;
  evaluatedAt: string;
  inventoryFingerprint: string;
  policyFingerprint: string;
  decisions: Decision[];
  counts: { scanned: number; protected: number; eligible: number };
}

// Registry manifest evidence used to propagate OCI protection. Digests whose
// manifest could not be inspected land in `unknown` and fail closed.
export interface OciEvidence {
  children: Map<string, string[]>;
  subjects: Map<string, string>;
  unknown: Set<string>;
}

export type ApplyOutcome = "deleted" | "absent" | "failed";

export interface ApplyResult {
  versionId: number;
  digest: string;
  outcome: ApplyOutcome;
  error?: string;
}

export interface ApplyReport {
  schemaVersion: 1;
  owner: string;
  package: string;
  planSha256: string;
  startedAt: string;
  finishedAt: string;
  results: ApplyResult[];
  counts: { deleted: number; absent: number; failed: number };
  validation: "passed" | "failed" | "skipped";
}
