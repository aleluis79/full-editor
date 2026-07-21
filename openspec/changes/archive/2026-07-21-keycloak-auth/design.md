# Design: Keycloak Authentication & Document Ownership

## Technical Approach

Add OIDC auth via Keycloak across three layers: **backend JWT validation** (FastAPI dependency), **data model** (users + shares), and **frontend login** (ReactKeycloakProvider + Zustand auth store). Backend-first — get_current_user dependency gates all document operations. Sharing adds DB-backed permission checks in the storage layer. Infrastructure follows existing `docker run` pattern from Makefile (no docker-compose yet), but uses a dedicated Keycloak container.

## Architecture Decisions

### Decision: JWKS caching strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| No cache (fetch every request) | Simple but adds latency per request | ❌ |
| In-memory dict with TTL | Simple, no infra — fits single-process uvicorn | ✅ |
| Redis-backed cache | Overkill for single instance | ❌ |

**Rationale**: FastAPI with uvicorn runs single-process in dev. In-memory TTL cache is zero-infra and sufficient. If we scale to multiple workers later, switch to a shared cache.

### Decision: Permission enforcement layer

| Option | Tradeoff | Decision |
|--------|----------|----------|
| SQLAlchemy middleware | Couples auth to ORM lifecycle | ❌ |
| Storage layer (storage.py) | Follows existing pattern, testable | ✅ |
| FastAPI middleware | Too early — no user context yet | ❌ |

**Rationale**: Existing `storage.py` already separates DB queries from route handlers. Passing `current_user` to storage methods keeps permission logic alongside the queries it gates.

### Decision: Migration sequence

Multi-step migration to safely add ownership to existing documents: (1) create users table, (2) add nullable owner_id, (3) seed admin user, (4) assign unowned docs to admin, (5) create shares table, (6) make owner_id NOT NULL. Each step is a separate Alembic revision for auditability and rollback granularity.

### Decision: Frontend auth wrapping

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Wrap `<App>` in main.tsx | Cleaner — no prop drilling | ✅ |
| Wrap inside App.tsx | More coupling | ❌ |

**Rationale**: `main.tsx` is the React entry point. Wrapping there keeps `<App>` unaware of auth infra.

## Data Flow

```
Frontend                          Backend                         Keycloak
───────                           ───────                         ────────
1. User visits app
2. ReactKeycloakProvider
   checks session ──────────────► GET /auth/realms/.../.well-known/
   ◄──── redirect to KC login
3. User logs in at Keycloak
4. Keycloak redirects back
   with auth code
5. ReactKeycloakProvider
   exchanges code for tokens
6. Token stored in Zustand
7. API call with Bearer token ──► FastAPI route
                                    │
                                    ▼
                              get_current_user
                              ┌─────────────────┐
                              │ 1. Extract Bearer│
                              │ 2. Validate JWT  │
                              │    (JWKS cache)  │
                              │ 3. Auto-provision│
                              │    user in DB    │
                              │ 4. Return User   │
                              └─────────────────┘
                                    │
                                    ▼
                              storage.py
                              (owner/share checks)
                                    │
                                    ▼
                              SQLAlchemy ──► PostgreSQL
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/core/auth.py` | Create | JWT validation, JWKS caching, `get_current_user` dependency |
| `backend/app/models/user.py` | Create | UserModel + Pydantic schemas |
| `backend/app/models/sharing.py` | Create | DocumentShareModel |
| `backend/app/api/auth.py` | Create | `GET /api/auth/me` endpoint |
| `backend/app/api/shares.py` | Create | Share CRUD endpoints |
| `backend/app/models/document.py` | Modify | Add `owner_id` FK col + helper methods |
| `backend/app/core/storage.py` | Modify | Owner-scoped queries, permission-gated CRUD |
| `backend/app/api/documents.py` | Modify | Add `current_user` dependency, owner/share enforcement |
| `backend/app/main.py` | Modify | Include auth + shares routers |
| `backend/requirements.txt` | Modify | Add `python-jose[cryptography]` |
| `backend/tests/conftest.py` | Modify | Override `get_current_user`, add test user fixture |
| `backend/tests/test_auth.py` | Create | Auth endpoint tests |
| `backend/tests/test_shares.py` | Create | Share API tests |
| `frontend/src/api/client.ts` | Modify | Inject Bearer token from auth-store |
| `frontend/src/stores/auth-store.ts` | Create | Zustand auth store |
| `frontend/src/components/LoginPage.tsx` | Create | Login gate component |
| `frontend/src/main.tsx` | Modify | Wrap with `ReactKeycloakProvider` |
| `frontend/src/App.tsx` | Modify | Auth-aware routing (login vs editor) |
| `frontend/package.json` | Modify | Add `keycloak-js`, `@react-keycloak/web` |
| `Makefile` | Modify | Add `keycloak-start`, `keycloak-stop` targets |
| `docker-compose.yml` | Create | Keycloak + PostgreSQL services (or minimal docker run) |

## Interfaces / Contracts

```python
# backend/app/core/auth.py
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> UserModel:
    """FastAPI dependency — validates JWT, auto-provisions, returns User."""

# backend/app/models/user.py
class UserModel(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_id)
    keycloak_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

# backend/app/models/sharing.py
class DocumentShareModel(Base):
    __tablename__ = "document_shares"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), nullable=False)
    shared_with_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    permission: Mapped[str] = mapped_column(String(16), nullable=False)  # "read" | "write"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | JWT decode, auto-provision logic | Mock JWKS, test `get_current_user` with valid/expired tokens |
| Integration | Share CRUD, permission enforcement | Override `get_current_user` in conftest.py to inject test UserModel |
| Integration | Owner-scoped document listing | Test list/create/delete with auth override |
| Frontend | Auth store initialization | Vitest mock `keycloak-js` |
| E2E | Full login flow | Manual (requires running Keycloak) |

**Key test strategy**: `conftest.py` overrides `get_current_user` with a fixture that returns a test `UserModel`. All existing tests keep working because the override means no real JWT is needed. New tests for share/permission scenarios use the same override.

## Migration / Rollout

1. **Install deps**: `pip install python-jose[cryptography]`, `npm install keycloak-js @react-keycloak/web`
2. **New models**: Create users table migration (revision 2)
3. **Add owner_id**: Nullable FK on documents (revision 3)
4. **Seed admin + migrate docs**: Migration populates admin user, assigns unowned docs (revision 4)
5. **Make owner_id NOT NULL**: Final migration step (revision 5)
6. **Document shares table**: Create share model migration (revision 6)
7. **Backend auth**: Deploy auth.py, get_current_user dep, protected routes
8. **Frontend auth**: Deploy ReactKeycloakProvider, login page, token injection
9. **Keycloak infra**: `make keycloak-start`

**Rollback**: Stop Keycloak, revert all 5 Alembic revisions, remove auth deps, revert frontend.

## Open Questions

- [ ] Keycloak config realm/client setup — manual via admin console or automated script?
- [ ] Keycloak URL — use env var with sensible default (http://localhost:8080)?
- [ ] Email as display_name fallback when JWT has no `name` claim?
