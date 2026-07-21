# Proposal: Keycloak Authentication & Document Ownership

## Intent

No auth — documents are global, all users see everything. Add Keycloak-based auth, document ownership, and sharing.

## Scope

### In Scope
- Backend JWT validation via `python-jose` JWKS + auto-provision middleware
- Frontend OIDC login via `@react-keycloak/web` + Zustand auth store
- `users` table + `owner_id` FK on documents (nullable → seed admin → NOT NULL)
- `document_shares` table with CRUD + permission enforcement
- Keycloak Docker via `keycloak-start` Makefile target
- Login page + auth-aware routing
- Auth override in test client (existing tests pass)

### Out of Scope
- RBAC / admin panel, multi-workspace, social login, SAML, audit logging

## Capabilities

### New Capabilities
- `user-auth`: OIDC login, JWT validation, auto-provision, protected API
- `document-sharing`: share docs (read/write), shared-with-me listing, permission enforcement

### Modified Capabilities
- `document-management`: docs MUST have owner, list/filter by ownership+sharing, enforce create/delete auth

## Approach

Backend auth → frontend auth → sharing. Backend: `get_current_user` dep, JWKS caching, UserModel, owner migration. Frontend: `ReactKeycloakProvider`, auth-store, LoginPage, Bearer header. Sharing: table, endpoints, permission-gated storage.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/core/auth.py` | New | JWKS validation + auto-provision |
| `backend/app/models/user.py` | New | UserModel + schemas |
| `backend/app/models/sharing.py` | New | DocumentShare model |
| `backend/app/api/auth.py` | New | Login/user-info endpoints |
| `frontend/src/stores/auth-store.ts` | New | Zustand auth state |
| `frontend/src/components/LoginPage.tsx` | New | Login → Keycloak |
| `backend/app/models/document.py` | Modified | `owner_id` FK |
| `backend/app/core/storage.py` | Modified | Owner-scoped queries |
| `backend/app/api/documents.py` | Modified | `current_user` dep + owner enforcement |
| `frontend/src/api/client.ts` | Modified | Bearer token header |
| `Makefile` | Modified | `keycloak-start` target |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| JWKS cache miss per request | Low | 1h TTL cache in auth.py |
| Migration with existing docs | Med | Nullable FK → seed admin → NOT NULL |
| Auto-provision race | Low | UNIQUE on `keycloak_id`, ON CONFLICT DO NOTHING |
| Existing tests fail | Med | Override `get_current_user` in conftest.py |

## Rollback Plan

1. Stop Keycloak container, remove `keycloak-start`
2. Revert Alembic (drop shares, owner_id, users)
3. Remove auth middleware + `get_current_user` from routes
4. Revert frontend to unprotected App.tsx + bare client.ts

## Dependencies

- Docker: `quay.io/keycloak/keycloak:latest`
- Backend: `python-jose[cryptography]`, `httpx`
- Frontend: `keycloak-js`, `@react-keycloak/web`

## Success Criteria

- [ ] New user logs in → auto-provisioned in DB
- [ ] API returns only owned + shared docs per user
- [ ] Existing unowned docs migrated to admin
- [ ] Share/unshare flow works end-to-end
- [ ] `make test` passes with auth override
