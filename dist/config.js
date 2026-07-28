import { input, mask } from "./io.js";
function integer(name, value, min, max) {
    if (!/^\d+$/.test(value))
        throw new Error(`${name} must be an integer`);
    const n = Number(value);
    if (n < min || n > max)
        throw new Error(`${name} must be between ${min} and ${max}`);
    return n;
}
function bool(name, value) {
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    throw new Error(`${name} must be true or false`);
}
export function rules(value) {
    const lines = value
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter((x) => x && !x.startsWith("#"));
    if (lines.length > 50)
        throw new Error("No more than 50 tag rules are allowed");
    return lines.map((line) => {
        if (line.length > 256)
            throw new Error("Tag rule exceeds 256 characters");
        if (line.startsWith("/") && line.endsWith("/") && line.length > 2) {
            const source = line.slice(1, -1);
            try {
                return { kind: "regex", value: line, regex: new RegExp(source) };
            }
            catch {
                throw new Error(`Invalid regular expression: ${line}`);
            }
        }
        return { kind: "exact", value: line };
    });
}
export function loadConfig() {
    const token = input("token", true);
    mask(token);
    const ownerType = input("owner-type") || "auto";
    if (ownerType !== "auto" && ownerType !== "organization" && ownerType !== "user")
        throw new Error("owner-type must be auto, organization, or user");
    return {
        token,
        owner: input("owner", true),
        ownerType,
        packageName: input("package", true),
        protectedRules: rules(input("protected-tags")),
        ephemeralRules: rules(input("ephemeral-tags")),
        ephemeralDays: integer("ephemeral-retention-days", input("ephemeral-retention-days") || "30", 0, 36500),
        untaggedDays: integer("untagged-retention-days", input("untagged-retention-days") || "7", 0, 36500),
        keepLatest: integer("keep-latest", input("keep-latest") || "10", 0, 10000),
        deleteUntagged: bool("delete-untagged", input("delete-untagged") || "false"),
        alwaysKeepNewest: bool("always-keep-newest", input("always-keep-newest") || "true"),
        protectMultiArch: bool("protect-multi-arch", input("protect-multi-arch") || "true"),
        protectReferrers: bool("protect-referrers", input("protect-referrers") || "true"),
        dryRun: bool("dry-run", input("dry-run") || "true"),
        confirmDelete: input("confirm-delete"),
        failOnEmpty: bool("fail-on-empty", input("fail-on-empty") || "false"),
        verifyInventoryBeforeApply: bool("verify-inventory-before-apply", input("verify-inventory-before-apply") || "true"),
        validateAfterCleanup: bool("validate-after-cleanup", input("validate-after-cleanup") || "true"),
        maxDeletions: integer("max-deletions", input("max-deletions") || "20", 0, 10000),
        maxDeletePercentage: integer("max-delete-percentage", input("max-delete-percentage") || "25", 0, 100),
        concurrency: integer("concurrency", input("concurrency") || "2", 1, 10),
        retryCount: integer("retry-count", input("retry-count") || "3", 0, 5),
    };
}
//# sourceMappingURL=config.js.map