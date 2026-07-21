# Tasks: Keycloak Authentication & Document Ownership

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950 |
| 800-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation + Backend Auth) → PR 2 (Sharing) → PR 3 (Frontend Auth + Infra + Tests) |
| Delivery strategy | single-pr-default |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + Backend Auth (models, auth.py, get_current_user, auto-provision) | PR 1 | Base: main. ~380 lines. Independent deliverable — protected API works. |
| 2 | Backend Sharing (shares model, API, storage permission checks) | PR 2 | Base: main or PR 1 branch. Depends on users table. ~250 lines. |
| 3 | Frontend Auth + Infra + Tests (auth-store, LoginPage, ReactKeycloakProvider, docker-compose, Makefile, tests) | PR 3 | Base: main or PR 2 branch. ~320 lines. |

## Phase 1: Foundation

- [x] 1.1 Add `python-jose[cryptography]` and `httpx` to `backend/requirements.txt`
- [x] 1.2 Create `backend/app/models/user.py` — UserModel ORM + Pydantic schemas
- [x] 1.3 Create `backend/app/models/sharing.py` — DocumentShareModel
- [x] 1.4 Add `owner_id` nullable FK column to `backend/app/models/document.py`
- [x] 1.5 Add Keycloak OIDC config to `backend/app/config.py`
- [x] 1.6 Add Keycloak env vars to `backend/.env`

## Phase 2: Backend Auth

- [x] 2.1 Create `backend/app/core/auth.py` — JWKS caching, JWT validation, `get_current_user` dependency with auto-provision
- [x] 2.2 Create `backend/app/api/auth.py` — `GET /api/auth/me` returning current user
- [x] 2.3 Register auth + shares routers in `backend/app/main.py` + CORS for Keycloak origin

## Phase 3: Backend Sharing

- [x] 3.1 Update `backend/app/core/storage.py` — owner-scoped list, permission-gated get/update/delete, accept `current_user` param
- [x] 3.2 Update `backend/app/api/documents.py` — add `current_user` dependency, pass to storage, enforce owner-only delete, shared-with-me listing
- [x] 3.3 Create `backend/app/api/shares.py` — create/list/revoke shares with owner-only enforcement

## Phase 4: Frontend Auth

- [x] 4.1 Add `keycloak-js` and `@react-keycloak/web` to `frontend/package.json`
- [x] 4.2 Create `frontend/src/stores/auth-store.ts` — Zustand auth store
- [x] 4.3 Create `frontend/src/components/LoginPage.tsx` — login gate component
- [x] 4.4 Update `frontend/src/main.tsx` — wrap `<App>` with ReactKeycloakProvider
- [x] 4.5 Update `frontend/src/App.tsx` — auth-aware routing (login gate / editor)
- [x] 4.6 Update `frontend/src/api/client.ts` — inject Bearer token from auth store

## Phase 5: Infrastructure

- [x] 5.1 Create `docker-compose.yml` — Keycloak + PostgreSQL services
- [x] 5.2 Add `keycloak-start`, `keycloak-stop`, `keycloak-logs` targets to `Makefile`
- [x] 5.3 Add `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` env vars to `backend/.env`

## Phase 6: Testing

- [x] 6.1 Update `backend/tests/conftest.py` — override `get_current_user`, add test user fixture
- [x] 6.2 Create `backend/tests/test_auth.py` — valid/expired token, auto-provision, `GET /api/auth/me`
- [x] 6.3 Create `backend/tests/test_shares.py` — share CRUD, permission enforcement, owner-only revoke
