import { pool } from "./concurrency.js";
import { loadConfig } from "./config.js";
import { deleteVersion, listVersions, resolveOwnerType } from "./github.js";
import { fail, info, output, save, summary, warning } from "./io.js";
import { gatherOciEvidence } from "./oci.js";
import { assertBudget, buildPlan, planHash, protectOciRelations } from "./policy.js";
const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");
export async function run() {
    const loaded = loadConfig();
    const c = {
        ...loaded,
        ownerType: await resolveOwnerType(loaded),
    };
    info(`Arklean: evaluating ${c.owner}/${c.packageName}`);
    const versions = await listVersions(c);
    if (c.failOnEmpty && versions.length === 0)
        throw new Error("ABORTED_NO_MATCH: package contains no versions");
    let plan = buildPlan(c, versions);
    if ((c.protectMultiArch || c.protectReferrers) && plan.counts.eligible > 0) {
        const evidence = await gatherOciEvidence(c, versions);
        if (evidence.unknown.size > 0)
            warning(`OCI inspection incomplete for ${evidence.unknown.size} version(s); unknown relations fail closed`);
        plan = protectOciRelations(plan, evidence, c);
    }
    const hash = planHash(plan);
    const dir = process.env.RUNNER_TEMP || process.cwd();
    const planPath = `${dir}/arklean-plan-${sanitize(c.packageName)}.json`;
    await save(planPath, JSON.stringify({ ...plan, planSha256: hash }, null, 2));
    assertBudget(c, plan);
    const eligible = plan.decisions.filter((d) => d.disposition === "eligible");
    const results = [];
    let deleted = 0;
    let absent = 0;
    let failed = 0;
    let resultPath = "";
    let validation = "skipped";
    if (c.dryRun) {
        warning(`Dry-run enabled: ${eligible.length} versions would be deleted`);
    }
    else {
        const expected = `${c.owner}/${c.packageName}`;
        if (c.confirmDelete !== expected)
            throw new Error(`Apply mode requires confirm-delete to equal ${expected}`);
        if (c.verifyInventoryBeforeApply) {
            const current = await listVersions(c);
            const replan = buildPlan(c, current, new Date(plan.evaluatedAt));
            if (replan.inventoryFingerprint !== plan.inventoryFingerprint)
                throw new Error("ABORTED_INVENTORY_CHANGED: package inventory changed between plan and apply; aborting before deletion");
        }
        const startedAt = new Date().toISOString();
        await pool(eligible, c.concurrency, async (d) => {
            try {
                const outcome = await deleteVersion(c, d.versionId);
                if (outcome === "deleted")
                    deleted++;
                else
                    absent++;
                results.push({ versionId: d.versionId, digest: d.digest, outcome });
            }
            catch (e) {
                failed++;
                const message = e instanceof Error ? e.message : "Deletion failed";
                results.push({
                    versionId: d.versionId,
                    digest: d.digest,
                    outcome: "failed",
                    error: message,
                });
                warning(message);
            }
        });
        results.sort((a, b) => a.versionId - b.versionId);
        if (c.validateAfterCleanup) {
            const after = await listVersions(c);
            const remaining = new Set(after.map((v) => v.id));
            const missingProtected = plan.decisions.filter((d) => d.disposition === "protected" && !remaining.has(d.versionId));
            validation = missingProtected.length === 0 ? "passed" : "failed";
            for (const d of missingProtected)
                warning(`Validation: protected version ${d.versionId} is no longer present`);
        }
        const report = {
            schemaVersion: 1,
            owner: c.owner,
            package: c.packageName,
            planSha256: hash,
            startedAt,
            finishedAt: new Date().toISOString(),
            results,
            counts: { deleted, absent, failed },
            validation,
        };
        resultPath = `${dir}/arklean-result-${sanitize(c.packageName)}.json`;
        await save(resultPath, JSON.stringify(report, null, 2));
    }
    await Promise.all([
        output("scanned", plan.counts.scanned),
        output("protected", plan.counts.protected),
        output("eligible", plan.counts.eligible),
        output("deleted", deleted),
        output("absent", absent),
        output("failed", failed),
        output("plan-sha256", hash),
        output("plan-path", planPath),
        output("result-path", resultPath),
    ]);
    await summary(`## Arklean\n\n` +
        `- Package: \`${c.owner}/${c.packageName}\`\n` +
        `- Mode: **${c.dryRun ? "dry-run" : "apply"}**\n` +
        `- Scanned: ${plan.counts.scanned}\n` +
        `- Protected: ${plan.counts.protected}\n` +
        `- Eligible: ${plan.counts.eligible}\n` +
        `- Deleted: ${deleted}\n` +
        `- Already absent: ${absent}\n` +
        `- Failed: ${failed}\n` +
        `- Post-apply validation: ${validation}\n` +
        `- Plan SHA-256: \`${hash}\`\n\n` +
        `> OCI: multi-arch children and referrers of retained versions are protected via registry manifests when enabled; unknown relations fail closed. Orphan referrer cleanup is not yet implemented.\n`);
    if (failed > 0)
        throw new Error(`${failed} deletion(s) failed`);
    if (validation === "failed")
        throw new Error("VALIDATION_FAILED: at least one protected version disappeared during apply");
}
run().catch((e) => fail(e instanceof Error ? e.message : "Unexpected Arklean failure"));
//# sourceMappingURL=main.js.map