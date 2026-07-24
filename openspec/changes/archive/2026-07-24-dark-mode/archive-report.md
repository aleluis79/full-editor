## Archive Report — dark-mode

**Archived**: 2026-07-24
**Mode**: hybrid (openspec + Engram)
**Archived to**: `openspec/changes/archive/2026-07-24-dark-mode/`

---

### Pre-Archive Gates

| Gate | Result |
|------|--------|
| Review Receipt Gate | Not required — no review gate configured |
| Task Completion (13/13) | ✅ All `[x]` in `tasks.md` |
| CRITICAL Verify Issues | ✅ 0 CRITICAL (5 WARNING only: CSS class assertions in UserMenu) |
| Artifact Completeness | ✅ All required artifacts present |

---

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| theme-system | Created | 7 requirements, 14 scenarios → `openspec/specs/theme-system/spec.md` |

Note: Main spec did not exist before — the delta spec was copied directly as the new source of truth.

---

### Archive Contents

```
openspec/changes/archive/2026-07-24-dark-mode/
├── design.md          ✅ Theme architecture decisions
├── explore.md         ✅ Feasibility exploration (optional)
├── proposal.md        ✅ Scope, approach, risks, rollback plan
├── specs/
│   └── theme-system/
│       └── spec.md    ✅ 7 requirements, 14 scenarios
├── tasks.md           ✅ 13/13 tasks complete
└── verify-report.md   ✅ PASS WITH WARNINGS (285/285 tests, TypeScript clean)
```

---

### Implementation Evidence

| File | Action | Tests |
|------|--------|-------|
| `frontend/src/stores/theme-store.ts` | New — Zustand store (preference/resolved/setPreference) | 15 unit tests |
| `frontend/src/hooks/useThemeInit.ts` | New — DOM sync hook | 6 integration tests |
| `frontend/src/components/UserMenu.tsx` | Modified — 3-button theme toggle | 9 component tests |
| `frontend/src/index.css` | Modified — `[data-theme="dark"]` block, 10 semantic vars, 77 hardcoded → variables | ⚠️ Manual visual check |
| `frontend/index.html` | Modified — Inline flicker-prevention script | ⚠️ Browser only |
| `frontend/src/i18n/locales/{en,es}/common.json` | Modified — 4 theme keys each | Keys verified |

**Total**: 30 new tests (23 files, 285 total). TypeScript: zero errors. All pre-existing tests preserved (255 → 285).

---

### Spec Compliance

7/7 requirements implemented, 7/7 verified. 5/7 have automated tests; 2 (CSS engine visuals, flicker prevention) are structural/manual-only by nature.

---

### Engram Traceability

| Artifact | Engram Observation ID |
|----------|----------------------|
| Exploration | #153 |
| Proposal | #154 |
| Spec | #155 |
| CSS Discovery | #156 |
| Design | #157 |
| Tasks | #158 |
| Apply Progress | #159 |
| Verify Report | #160 |
| Archive Report | #161 |

---

### Warnings

- 5 WARNING: CSS class assertions in UserMenu tests (`.className.toContain('active')`) — standard jsdom pattern, pre-existing convention, non-blocking.
- SUGGESTION: Coverage tool not installed.
- NOTE: Spec required dark overrides for 13 base vars; design implemented 10 semantic vars instead (intentional per tasks).

---

### SDD Cycle Complete

The dark-mode change has been fully planned, implemented, verified, and archived. Ready for the next change.
