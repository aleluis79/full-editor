# User Authentication Specification

## Purpose

OIDC-based authentication via Keycloak — JWT validation, auto-provisioning, protected API, and frontend auth state management.

## Requirements

### Requirement: JWT Validation

The backend MUST validate Keycloak JWTs using the JWKS endpoint, verifying signature, expiry, and issuer on every authenticated request.

#### Scenario: Valid JWT accepted

- GIVEN a valid Keycloak JWT signed with a key from the JWKS endpoint
- WHEN the backend receives it as a Bearer token
- THEN the token is accepted and user identity is extracted

#### Scenario: Expired JWT rejected

- GIVEN an expired JWT
- WHEN the backend validates it
- THEN a 401 response is returned

### Requirement: Auto-Provision Users

The backend MUST create a User record in the local database upon first valid JWT from an unknown Keycloak user, keyed by `keycloak_id`.

#### Scenario: First login creates user

- GIVEN a valid JWT for a user not in the local DB
- WHEN the backend processes the request
- THEN a new User record is created from the JWT claims

#### Scenario: Returning user not duplicated

- GIVEN a valid JWT for an existing local user
- WHEN the backend processes the request
- THEN no duplicate user is created

### Requirement: get_current_user Dependency

The backend MUST provide a FastAPI dependency `get_current_user` that extracts and returns the authenticated user from the Bearer token, used to protect routes.

#### Scenario: Dependency returns user

- GIVEN a valid Bearer token
- WHEN the dependency resolves
- THEN it returns the auto-provisioned User model

#### Scenario: Dependency rejects missing token

- GIVEN no Authorization header
- WHEN the dependency resolves
- THEN it raises a 401 exception

### Requirement: Frontend OIDC Login

The frontend MUST redirect unauthenticated users to the Keycloak login page using `@react-keycloak/web`. On success, Keycloak redirects back to the app.

#### Scenario: Unauthenticated user redirected

- GIVEN a user not logged in
- WHEN they access the app
- THEN they are redirected to the Keycloak login page

#### Scenario: Authenticated user enters app

- GIVEN a user with an active Keycloak session
- WHEN the OIDC flow completes
- THEN they are redirected to the app main page

### Requirement: Auth Store

The frontend MUST maintain a Zustand auth store that exposes the authenticated user's info, login state, and token.

#### Scenario: Session state available

- GIVEN a user who completed OIDC login
- WHEN the auth store initializes
- THEN user info and token are available to all components

### Requirement: Bearer Token on API Calls

The API client MUST attach the Keycloak access token as an `Authorization: Bearer <token>` header on every backend request.

#### Scenario: Authorized API call

- GIVEN an authenticated user with a valid token
- WHEN the frontend makes an API request
- THEN the Bearer token header is included
