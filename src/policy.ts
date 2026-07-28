import { createHash } from "node:crypto";
import type { Config, Decision, OciEvidence, PackageVersion, Plan, Reason, ResolvedConfig, Rule } from "./types.js";

const DAY = 86400000;

const hash = (s: string): string => createHash("sha256").update(s).digest("hex");

function match(tags: string[], rules: Rule[]): string | undefined {
  for (const rule of rules)
    for (const tag of tags) if (rule.kind === "exact" ? tag === rule.value : rule.regex.test(tag)) return rule.value;
  return undefined;
}

export function buildPlan(c: ResolvedConfig, versions: PackageVersion[], now = new Date()): Plan {
  const decisions: Decision[] = [];
  const otherwiseEligible: Decision[] = [];

  for (const v of versions) {
    const protectedRule = match(v.tags, c.protectedRules);
    if (protectedRule) {
      decisions.push({
        versionId: v.id,
        digest: v.name,
        tags: [...v.tags].sort(),
        createdAt: v.createdAt,
        disposition: "protected",
        reason: "PROTECTED_TAG",
        matchedRule: protectedRule,
      });
      continue;
    }
    const age = (now.getTime() - new Date(v.createdAt).getTime()) / DAY;
    if (v.tags.length === 0) {
      if (c.deleteUntagged && age >= c.untaggedDays)
        otherwiseEligible.push({
          versionId: v.id,
          digest: v.name,
          tags: [],
          createdAt: v.createdAt,
          disposition: "eligible",
          reason: "ELIGIBLE_UNTAGGED",
        });
      else
        decisions.push({
          versionId: v.id,
          digest: v.name,
          tags: [],
          createdAt: v.createdAt,
          disposition: "protected",
          reason: "PROTECTED_TOO_RECENT",
        });
      continue;
    }
    const ephemeral = match(v.tags, c.ephemeralRules);
    if (!ephemeral) {
      decisions.push({
        versionId: v.id,
        digest: v.name,
        tags: [...v.tags].sort(),
        createdAt: v.createdAt,
        disposition: "protected",
        reason: "PROTECTED_UNMATCHED_TAG",
      });
      continue;
    }
    if (age < c.ephemeralDays) {
      decisions.push({
        versionId: v.id,
        digest: v.name,
        tags: [...v.tags].sort(),
        createdAt: v.createdAt,
        disposition: "protected",
        reason: "PROTECTED_TOO_RECENT",
        matchedRule: ephemeral,
      });
      continue;
    }
    otherwiseEligible.push({
      versionId: v.id,
      digest: v.name,
      tags: [...v.tags].sort(),
      createdAt: v.createdAt,
      disposition: "eligible",
      reason: "ELIGIBLE_EPHEMERAL",
      matchedRule: ephemeral,
    });
  }

  const tagged = otherwiseEligible
    .filter((x) => x.tags.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.versionId - a.versionId);
  const keepLatestIds = new Set(tagged.slice(0, c.keepLatest).map((x) => x.versionId));

  let newestId: number | undefined;
  if (c.alwaysKeepNewest && versions.length > 0) {
    const newest = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)[0];
    if (newest) newestId = newest.id;
  }

  for (const d of otherwiseEligible) {
    if (keepLatestIds.has(d.versionId))
      decisions.push({
        ...d,
        disposition: "protected",
        reason: "PROTECTED_KEEP_LATEST",
      });
    else if (d.versionId === newestId)
      decisions.push({
        ...d,
        disposition: "protected",
        reason: "PROTECTED_NEWEST",
      });
    else decisions.push(d);
  }

  decisions.sort((a, b) => a.versionId - b.versionId);

  const policy = {
    protected: c.protectedRules.map((x) => x.value),
    ephemeral: c.ephemeralRules.map((x) => x.value),
    ephemeralDays: c.ephemeralDays,
    untaggedDays: c.untaggedDays,
    keepLatest: c.keepLatest,
    deleteUntagged: c.deleteUntagged,
    alwaysKeepNewest: c.alwaysKeepNewest,
  };
  const inventory = versions
    .map((v) => ({
      id: v.id,
      name: v.name,
      tags: [...v.tags].sort(),
      createdAt: v.createdAt,
    }))
    .sort((a, b) => a.id - b.id);

  return {
    schemaVersion: 1,
    owner: c.owner,
    ownerType: c.ownerType,
    package: c.packageName,
    evaluatedAt: now.toISOString(),
    inventoryFingerprint: hash(JSON.stringify(inventory)),
    policyFingerprint: hash(JSON.stringify(policy)),
    decisions,
    counts: {
      scanned: decisions.length,
      protected: decisions.filter((x) => x.disposition === "protected").length,
      eligible: decisions.filter((x) => x.disposition === "eligible").length,
    },
  };
}

const COSIGN_TAG = /^sha256-([0-9a-f]{64})(\..+)?$/;

// Propagate OCI protection from retained versions: index children, referrer
// subjects (OCI 1.1 `subject` field and cosign sha256-<digest>.<suffix> tag
// scheme), and unknown relations, which fail closed (ADR-003/ADR-005).
// Iterates to a fixpoint so a protected referrer's own children are also kept.
export function protectOciRelations(
  plan: Plan,
  evidence: OciEvidence,
  c: Pick<Config, "protectMultiArch" | "protectReferrers">,
): Plan {
  if (!c.protectMultiArch && !c.protectReferrers) return plan;
  const decisions = plan.decisions.map((d) => ({ ...d }));

  let changed = true;
  while (changed) {
    changed = false;
    const retained = new Set(decisions.filter((d) => d.disposition === "protected").map((d) => d.digest));
    const retainedHasUnknown =
      c.protectMultiArch && decisions.some((d) => d.disposition === "protected" && evidence.unknown.has(d.digest));

    for (const d of decisions) {
      if (d.disposition !== "eligible") continue;
      let reason: Reason | undefined;
      let relatedTo: string | undefined;

      if (c.protectMultiArch) {
        for (const parent of retained) {
          if (evidence.children.get(parent)?.includes(d.digest)) {
            reason = "PROTECTED_OCI_CHILD";
            relatedTo = parent;
            break;
          }
        }
      }
      if (!reason && c.protectReferrers) {
        const subject = evidence.subjects.get(d.digest);
        if (subject && retained.has(subject)) {
          reason = "PROTECTED_OCI_REFERRER";
          relatedTo = subject;
        } else {
          for (const tag of d.tags) {
            const m = tag.match(COSIGN_TAG);
            if (m && retained.has(`sha256:${m[1]}`)) {
              reason = "PROTECTED_OCI_REFERRER";
              relatedTo = `sha256:${m[1]}`;
              break;
            }
          }
        }
      }
      // Fail closed: no proof this version is safe to delete.
      if (!reason && evidence.unknown.has(d.digest)) reason = "PROTECTED_UNKNOWN_RELATION";
      if (!reason && retainedHasUnknown && d.tags.length === 0) reason = "PROTECTED_UNKNOWN_RELATION";

      if (reason) {
        d.disposition = "protected";
        d.reason = reason;
        if (relatedTo) d.matchedRule = relatedTo;
        changed = true;
      }
    }
  }

  return {
    ...plan,
    decisions,
    counts: {
      scanned: decisions.length,
      protected: decisions.filter((x) => x.disposition === "protected").length,
      eligible: decisions.filter((x) => x.disposition === "eligible").length,
    },
  };
}

// Determinism contract: the plan object is always constructed with the same key
// order and with decisions/tags/inventory sorted, so JSON.stringify is stable.
export function planHash(plan: Plan): string {
  return hash(JSON.stringify(plan));
}

export function assertBudget(c: Config, p: Plan): void {
  const n = p.counts.eligible;
  const pct = p.counts.scanned === 0 ? 0 : (n / p.counts.scanned) * 100;
  if (n > c.maxDeletions) throw new Error(`ABORTED_BUDGET_EXCEEDED: ${n} deletions > max-deletions ${c.maxDeletions}`);
  if (pct > c.maxDeletePercentage)
    throw new Error(`ABORTED_BUDGET_EXCEEDED: ${pct.toFixed(1)}% > max-delete-percentage ${c.maxDeletePercentage}%`);
}
