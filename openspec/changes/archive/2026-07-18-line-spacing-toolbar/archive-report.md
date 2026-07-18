# Archive Report: line-spacing-toolbar

**Archived**: 2026-07-18
**Mode**: Hybrid (Engram + OpenSpec)
**Status**: success — intentional-with-warnings

## Overview

Per-block line height control (`block-line-height` capability). Implemented `BlockAttrs.lineHeight`, layout engine overrides, DocumentView inline style, toolbar preset popup, icon, and history descriptions. 16/16 tasks complete, 131 tests passing.

## Spec Sync

**No merge performed** — this was a new capability (`block-line-height`), not a delta spec. The full spec was written directly to `openspec/specs/block-line-height/spec.md` during the spec phase. No merge needed per archive policy.

## Task Completion Gate

- `openspec/changes/archive/2026-07-18-line-spacing-toolbar/tasks.md`: All 16 tasks are `[x]` ✅
- Engram `sdd/line-spacing-toolbar/tasks` (id: #80): All tasks documented as complete ✅

## CRITICAL Bug — Post-Verify Fix Reconciliation

The initial `verify-report` (both Engram #83 and filesystem) returned **FAIL** due to a CRITICAL bug: `setBlockAttrsRange` in `document-store.ts` had undefined variables (`startIdx`, `endIdx`, `blocks`) causing multi-block lineHeight application to silently no-op.

**Resolution**: The bug was identified during verification, fixed, and re-tested:
1. `sdd-apply` sub-agent accidentally removed the `getBlockNodes(docClone)` + index resolution lines during implementation.
2. Fix applied: restored `const blocks = getBlockNodes(docClone)`, `const startIdx = blocks.findIndex(...)`, `const endIdx = blocks.findIndex(...)`, and early return guard.
3. Re-tested: **131/131 tests passing** (confirmed in apply-progress "Post-Verify Fix" section, Engram #81).

The verify-report artifact has been preserved as-is in the archive (it is an audit trail record of what verification found at that point in time). The archive report documents the fix for full traceability.

## Engram Observation IDs

| Artifact | Engram ID | Title |
|----------|-----------|-------|
| Exploration | #76 | sdd/line-spacing-toolbar/explore |
| Proposal | #77 | sdd/line-spacing-toolbar/proposal |
| Spec | #78 | sdd/line-spacing-toolbar/spec |
| Design | #79 | sdd/line-spacing-toolbar/design |
| Tasks | #80 | sdd/line-spacing-toolbar/tasks |
| Apply Progress | #81 | sdd/line-spacing-toolbar/apply-progress |
| Verify Report | #83 | sdd/line-spacing-toolbar/verify-report |
| Archive Report | (current) | sdd/line-spacing-toolbar/archive-report |

## Archive Contents

- `proposal.md` ✅ — Scope, approach, rollback plan
- `design.md` ✅ — Technical design with architecture decisions
- `exploration.md` ✅ — Initial exploration and analysis
- `tasks.md` ✅ — 16/16 tasks complete
- `verify-report.md` ✅ — Verification evidence (pre-fix capture)
- `archive-report.md` ✅ — This file

## Verification

- [x] Main spec exists at `openspec/specs/block-line-height/spec.md` (new capability)
- [x] Change folder moved to `openspec/changes/archive/2026-07-18-line-spacing-toolbar/`
- [x] Archive contains all artifacts
- [x] All 16 implementation tasks are [x] confirmed
- [x] CRITICAL bug fixed and re-tested (131/131 passing)
- [x] Active changes directory no longer has this change

## Source of Truth

- `openspec/specs/block-line-height/spec.md` — contains the full specification (in place since spec phase, no merge needed)

## SDD Cycle Complete

The change has been fully planned, explored, specified, designed, implemented (TDD), verified, bug-fixed, and archived. Ready for the next change.
