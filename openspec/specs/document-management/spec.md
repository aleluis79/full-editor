# Document Management Specification

## Purpose

Document ownership and access control — documents are owned by authenticated users, operations are gated by ownership and share permissions, and existing documents are migrated to the ownership model.

## Requirements

### Requirement: Document Ownership

A document MUST have an owner when created. The `owner_id` field MUST reference the authenticated user creating the document.

#### Scenario: Create document with owner

- GIVEN an authenticated user creating a document
- WHEN the create request is submitted
- THEN the document is created with the user as owner

#### Scenario: Anonymous create rejected

- GIVEN an unauthenticated request
- WHEN a document create is attempted
- THEN the request is rejected with 401

### Requirement: List Owned and Shared Documents

The document list endpoint MUST return documents owned by the current user AND documents shared with them.

#### Scenario: Owner sees owned documents

- GIVEN the current user owns several documents
- WHEN they request the document list
- THEN the list includes all their owned documents

#### Scenario: User sees shared documents in list

- GIVEN documents shared with the current user
- WHEN they request the document list
- THEN the list also includes those shared documents

### Requirement: Access Enforcement on Operations

Document read, update, and delete operations MUST verify the requesting user is the owner OR has appropriate share permissions (read for viewing, write for editing). Deleting is owner-only.

#### Scenario: Owner can delete

- GIVEN the current user owns a document
- WHEN they attempt to delete it
- THEN the deletion succeeds

#### Scenario: Non-owner cannot delete

- GIVEN a document the current user does not own
- WHEN they attempt to delete it
- THEN the request is rejected with 403

#### Scenario: Write-share user can update

- GIVEN a document shared with the user at write level
- WHEN they update it
- THEN the update succeeds

#### Scenario: Read-share user cannot update

- GIVEN a document shared with the user at read level
- WHEN they attempt to update it
- THEN the request is rejected with 403

### Requirement: Migrate Existing Documents

Existing documents without an owner MUST be assigned to an admin user during migration, then `owner_id` MUST become NOT NULL.

#### Scenario: Unowned documents assigned to admin

- GIVEN existing documents with NULL owner_id
- WHEN the migration runs
- THEN those documents are assigned to the configured admin user

#### Scenario: Already-owned documents preserved

- GIVEN existing documents with a valid owner_id
- WHEN the migration runs
- THEN their owner_id is unchanged
