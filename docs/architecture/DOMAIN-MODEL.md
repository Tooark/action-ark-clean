# Domain model

## Entities

`PackageRef`: owner, owner type, package type, package name.

`PackageVersion`: numeric API ID, digest/name, created/updated instants, complete tag set, raw metadata fingerprint.

`ArtifactRelation`: parent/subject version, child/referrer version, relation kind, confidence (`confirmed`, `inferred`, `unknown`).

`RetentionPolicy`: matching rules, durations, minimum keeps, OCI protections, budgets, execution settings.

`Decision`: version ID, disposition, reason code, human explanation, matched rule, relation evidence.

`CleanupPlan`: package, inventory fingerprint, policy fingerprint, evaluation instant, decisions, deletion set, safety status, canonical plan hash.

## Invariants

- Each version has exactly one final disposition, expressed by a single plan reason code; apply outcomes (`deleted`, `absent`, `failed`) are recorded per attempted deletion in the apply report and never replace the plan disposition.
- Protected decisions dominate eligible decisions.
- If any tag is protected, the version is protected.
- A confirmed retained root transitively protects confirmed required relations.
- Unknown relationships fail closed when OCI protection is enabled.
- The deletion set is a subset of discovered version IDs.
- The newest protection and keep-latest are evaluated after tag protection and before deletion.
- Plan ordering is stable by disposition, timestamp, and version ID.

## State flow

```text
DISCOVERED -> NORMALIZED -> CLASSIFIED -> PLANNED
PLANNED -> DRY_RUN_COMPLETE
PLANNED -> APPLYING -> APPLIED -> VALIDATED
APPLYING -> PARTIAL_FAILURE -> VALIDATED_OR_FAILED
```
