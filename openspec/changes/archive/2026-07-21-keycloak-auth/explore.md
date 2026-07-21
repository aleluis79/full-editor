## Exploration: Keycloak Authentication + Document Ownership

### Current State

**Backend — No auth whatsoever:**
- No authentication middleware, no user context, no JWT validation
- FastAPI routes (`GET /api/documents/`, `POST /api/documents/`, etc.) accept requests from anyone
- `DocumentModel` has **no `user_id`** — documents are global, every user sees every document
- `storage.py` lists/filters all documents with no user scoping
- `config.py` has only image upload config — no Keycloak URLs, secrets, or OIDC settings
- `requirements.txt` has no Keycloak or JWT dependencies

**Frontend — No auth UI or headers:**
- `client.ts` sends bare `fetch()` calls with no `Authorization` header
- `App.tsx` renders `DocumentManager` or `Editor` directly — no login guard, no auth routing
- `main.tsx` just mounts `<App />` with no wrapping auth provider
- `DocumentManager.tsx` loads all documents on mount, no user context
- `package.json` has no auth libraries

**Data model (single table):**
- Only `documents` table: `id`, `title`, `content`, `created_at`, `updated_at`
- No `users` table, no `user_id` FK, no sharing/permissions tables

**Infrastructure:**
- `Makefile` has `db-start`/`db-stop` for a PostgreSQL container — no Keycloak container command
- No `docker-compose.yml` — only standalone `docker run` commands
- No `.env` keys for Keycloak (only `DATABASE_URL`)

### Affected Areas

| File | Why affected |
|------|-------------|
| `backend/requirements.txt` | Needs `python-jose` + `httpx` (for JWKS fetch) + `python-keycloak` |
| `backend/.env` | Needs Keycloak URL, realm, client ID, client secret |
| `backend/app/config.py` | New config constants for Keycloak OIDC |
| `backend/app/core/database.py` | Needs new models registered (UserModel) |
| `backend/app/models/document.py` | Add `owner_id` FK, `DocumentResponse` gets owner info |
| `backend/app/models/user.py` | **New file** — UserModel + Pydantic schemas |
| `backend/app/models/sharing.py` | **New file** — DocumentShare model |
| `backend/app/core/storage.py` | Add owner filtering, shared-doc listing |
| `backend/app/core/auth.py` | **New file** — JWT validation, auto-provision middleware |
| `backend/app/api/documents.py` | Add `current_user` dependency, scope queries to user |
| `backend/app/api/auth.py` | **New file** — login endpoint, user info endpoint |
| `backend/app/main.py` | Add auth router, CORS for Keycloak redirects |
| `backend/alembic/versions/` | New migration for users + owner_id + shares tables |
| `backend/tests/conftest.py` | Auth overrides for test client |
| `backend/tests/test_api.py` | Auth headers in tests, owner-scoped assertions |
| `frontend/package.json` | Needs `keycloak-js` or `oidc-client-ts` |
| `frontend/src/api/client.ts` | Add Bearer token header to all requests |
| `frontend/src/App.tsx` | Auth-aware routing (login page vs editor) |
| `frontend/src/main.tsx` | Wrap app with auth context/provider |
| `frontend/src/stores/document-store.ts` | Inherit user context for API calls |
| `frontend/src/stores/auth-store.ts` | **New file** — Zustand store for auth state |
| `frontend/src/components/LoginPage.tsx` | **New file** — redirect to Keycloak |
| `frontend/src/components/DocumentManager.tsx` | Filter by owner, show shared docs |
| `frontend/vite.config.ts` | Proxy Keycloak URLs or adjust dev config |
| `Makefile` | New `keycloak-start` command |
| `.env` (root) | Keycloak connection variables |

### Approaches

#### 1. **Backend: Token validation + auto-provision middleware**
   - Validate Keycloak-issued JWTs using `python-jose` with JWKS endpoint
   - `get_current_user` FastAPI dependency: decode token → lookup/extract `sub` claim → auto-create user in DB if not exists → return user
   - Store user info: `keycloak_id` (unique), `username`, `email`, `display_name`
   - Pros: No external client library needed, full control, JWKS keys rotate automatically
   - Cons: Need to handle JWKS caching, token refresh is client-side
   - Effort: Medium

#### 2. **Frontend: keycloak-js adapter**
   - `keycloak-js` handles the OIDC redirect flow automatically
   - Wrap `<App />` in `ReactKeycloakProvider` from `@react-keycloak/web`
   - Store tokens in memory, attach `Authorization: Bearer <token>` to API calls
   - Pros: Battle-tested, handles token refresh, simple API
   - Cons: Adds ~50KB to bundle, somewhat opinionated about flow
   - Effort: Low

#### 3. **Frontend: oidc-client-ts** (alternative to keycloak-js)
   - More generic OIDC client, not Keycloak-specific
   - Manual token management in Zustand store
   - Pros: Smaller bundle, more control, works with any OIDC provider
   - Cons: More boilerplate, need to handle refresh manually
   - Effort: Medium

#### 4. **Data model: owner FK + shares table**
   - `users` table: `id`, `keycloak_id` (unique), `username`, `email`, `display_name`, `created_at`
   - Add `owner_id` FK (NOT NULL) to `documents`
   - `document_shares` table: `id`, `document_id` (FK), `user_id` (FK), `permission` (enum: read/write/admin), `created_at`
   - `list_documents` returns docs WHERE owner_id = user OR document_id IN (shared doc IDs)
   - Effort: Medium

#### 5. **Existing documents migration strategy**
   - Create `admin` user in `users` table via seed migration
   - Make `owner_id` initially nullable for the migration, add the column
   - Assign all existing documents to the admin user
   - Then make `owner_id` NOT NULL
   - Effort: Low

#### 6. **Keycloak infrastructure**
   - Add `keycloak-start` Makefile target (similar to `db-start` pattern)
   - Docker run for `quay.io/keycloak/keycloak:latest` with import realm config
   - Or use a `docker-compose.yml` that orchestrates both PostgreSQL and Keycloak
   - Effort: Low

#### 7. **Sharing (post-MVP)**
   - `shared_with_me` endpoint: `GET /api/documents/shared`
   - Owner can POST/DELETE to `/api/documents/{id}/share` to manage access
   - Permissions enforced in `storage.py` on write operations
   - Effort: Medium (can be split into later phase)

### Recommendation

**Phase 1 (core auth + ownership):**
- **Backend**: `python-jose` with JWKS validation + auto-provision middleware (Approach 1). It's lightweight, no extra client lib, and maps cleanly to FastAPI dependencies.
- **Frontend**: `keycloak-js` via `@react-keycloak/web` (Approach 2). It's the simplest path for Keycloak — handles redirect, token refresh, and session management with minimal code.
- **Data model**: `users` table + `owner_id` on documents (Approach 4). Create a nullable migration first, seed admin user, assign existing documents, then make it NOT NULL.
- **Infrastructure**: `keycloak-start` Makefile target (Approach 6). Follows the existing `db-start` pattern.

**Phase 2 (sharing):**
- `document_shares` table + share management endpoints + permission enforcement in storage layer.

**Phase 3 (full multi-user):**
- Document listing filtered by ownership/sharing, admin user management.

### Risks

1. **JWKS caching** — The middleware must cache the JWKS endpoint response and refresh periodically (e.g., every hour). Without caching, every API call fetches the JWKS, adding latency.
2. **Token expiry UX** — If access tokens expire (default 5-60 min), the frontend needs to handle 401 responses gracefully and redirect to Keycloak or refresh the token. `keycloak-js` handles this automatically.
3. **Migration downtime** — Adding `owner_id` as NOT NULL to an existing table with documents requires a multi-step migration: add nullable column → assign admin owner → make NOT NULL. This is safe but must be done in separate Alembic revisions.
4. **CORS on login redirect** — Keycloak redirects back to the frontend after login. If Keycloak runs on a different port (e.g., `:8080`) than the frontend (`:5173`), CORS settings on both Keycloak and the FastAPI backend must allow the callback URL.
5. **Auto-provisioning race** — Two concurrent requests from the same new user could race to create the DB user. Use `INSERT ... ON CONFLICT DO NOTHING` or a unique constraint on `keycloak_id` to handle this.
6. **Existing tests** — All current tests make unauthenticated requests and expect 200 responses. After adding auth middleware, tests must either get a valid token or override the auth dependency. The `conftest.py` pattern (dependency override) handles this cleanly.

### Ready for Proposal
Yes. The exploration is complete and the approach is clear. Proceed with **sdd-propose** for `keycloak-auth`.
