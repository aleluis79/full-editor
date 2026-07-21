# Document Sharing Specification

## Purpose

Document-level sharing — users share documents with others at read or write permission levels, list documents shared with them, and revoke access.

## Requirements

### Requirement: Share Document

A user MUST be able to share a document with another user at a specified permission level (read or write).

#### Scenario: Share with read permission

- GIVEN the current user owns a document
- WHEN they share it with another user at read level
- THEN a DocumentShare record is created with the target user and read permission

#### Scenario: Share with write permission

- GIVEN the current user owns a document
- WHEN they share it with another user at write level
- THEN a DocumentShare record is created with write permission

#### Scenario: Non-owner cannot share

- GIVEN the current user does not own the document
- WHEN they attempt to share it
- THEN the request is rejected with 403

### Requirement: List Shared-With-Me

The system MUST return documents shared with the current user, including the sharing user's info and permission level.

#### Scenario: List shared documents

- GIVEN another user has shared documents with the current user
- WHEN the current user requests their shared-with-me list
- THEN the response includes shared documents and permission levels

#### Scenario: Empty shared list

- GIVEN no documents have been shared with the current user
- WHEN they request shared-with-me
- THEN an empty list is returned

### Requirement: Revoke Share

The document owner MUST be able to revoke a share, removing the target user's access.

#### Scenario: Revoke existing share

- GIVEN a document shared with another user
- WHEN the owner revokes the share
- THEN the DocumentShare record is deleted

#### Scenario: Non-owner cannot revoke

- GIVEN a document the current user does not own
- WHEN they attempt to revoke a share
- THEN the request is rejected with 403

### Requirement: Permission Enforcement

The backend MUST enforce share permissions — read access allows viewing, write access allows editing. No access means 403.

#### Scenario: Read share allows viewing

- GIVEN a document shared with the user at read level
- WHEN they request to read the document
- THEN the request succeeds

#### Scenario: Read share blocks editing

- GIVEN a document shared with the user at read level
- WHEN they attempt to update the document
- THEN the request is rejected with 403

#### Scenario: Write share allows editing

- GIVEN a document shared with the user at write level
- WHEN they update the document
- THEN the request succeeds
