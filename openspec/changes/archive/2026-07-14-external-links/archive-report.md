# Archive Report: external-links

**Archived**: 2026-07-14
**Mode**: hybrid (Engram + OpenSpec filesystem)
**Verdict**: PASS WITH WARNINGS (no CRITICAL issues)

## Engram Observation IDs

| Artifact | Observation ID | Title |
|----------|---------------|-------|
| Spec | #40 | sdd/external-links/spec |
| Design | #41 | sdd/external-links/design |
| Tasks | #42 | sdd/external-links/tasks |
| Apply-Progress | #45 | SDD Apply-Progress: external-links |
| Verify-Report | (not found in Engram; filesystem only) | N/A |
| Archive-Report | (this document) | sdd/external-links/archive-report |

## Task Completion Gate

- All 25 tasks checked (`[x]`) in both Engram (#42) and filesystem (`tasks.md`). ✅ Passed.
- No stale unchecked implementation tasks found.

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| external-links | Created | Full spec copied — no main spec existed previously. 7 requirements, 12 scenarios synced to `openspec/specs/external-links/spec.md`. |

## Archive Contents (filesystem)

```
openspec/changes/archive/2026-07-14-external-links/
├── proposal.md
├── specs/
│   └── external-links/
│       └── spec.md
├── design.md
├── tasks.md (25/25 complete)
├── verify-report.md
└── archive-report.md
```

## Verification Summary

- **96 tests passing** (73 frontend + 23 backend)
- **12/14 spec scenarios** fully compliant
- **1 PARTIAL**: URL validation tests only test `String.trim()` (weak)
- **1 UNTESTED**: Partial-selection link removal within a linked run (behavior not matching spec)
- **0 CRITICAL** issues
- **2 WARNING** issues (documented in verify-report)

## Source of Truth Updated

`openspec/specs/external-links/spec.md` — External Links specification is now part of the permanent spec tree.

## Notes

- The delta spec was a full spec (not a delta), so it was copied directly to main specs.
- No merge conflicts, removals, or renames involved.
- The `mergeRuns` function referenced in the design was not found in the codebase, but this did not block implementation (per apply-progress).
