# Document Comments Specification

## Purpose

Users collaborating on documents can attach threaded comments to specific blocks, view them in a sidebar via indicators, and toggle visibility — enabling async feedback in context.

## Requirements

### Requirement: Comment CRUD

The system MUST allow users with read access to create, reply to, update, and delete comments on document blocks.

#### Scenario: Create a comment on a block

- GIVEN I have read access to a document
- WHEN I click the comment indicator on a block or right-click → "Add comment"
- THEN a new comment form appears in the sidebar
- WHEN I type text and submit
- THEN a comment is created and appears in the sidebar under that block's thread
- AND a comment indicator dot appears in the page gutter at that block's height

#### Scenario: Reply to a comment

- GIVEN a document has an existing comment thread on block X
- WHEN I click "Reply" on that thread
- THEN an inline reply form appears
- WHEN I type text and submit
- THEN the reply appears nested under the parent comment
- AND the indicator count updates

#### Scenario: Delete a comment

- GIVEN I am the comment author
- WHEN I click Delete on my comment
- THEN the comment is removed
- AND if it was the last comment in a thread, the indicator disappears

#### Scenario: Non-author cannot delete or update

- GIVEN I am NOT the comment author
- WHEN I attempt to delete or update the comment
- THEN the system MUST return 403 Forbidden

### Requirement: Resolve workflow

The system MUST allow comment authors and document owners to toggle thread resolved status.

#### Scenario: Resolve and unresolve

- GIVEN I am the comment author or document owner
- WHEN I click "Resolve" on a thread
- THEN the thread is marked as resolved
- AND the indicator changes appearance (e.g., fainter color)
- WHEN I click "Resolve" again
- THEN the thread is marked as unresolved

#### Scenario: Non-owner cannot resolve

- GIVEN I am neither the comment author nor the document owner
- WHEN I attempt to resolve
- THEN the system MUST return 403 Forbidden

### Requirement: Comment visibility toggle

The system MUST provide a toolbar button to show/hide the comment sidebar and indicators.

#### Scenario: Toggle visibility

- GIVEN I am viewing a document with the comment sidebar open
- WHEN I toggle the comments button in the toolbar
- THEN the sidebar and all indicators hide
- WHEN I toggle again
- THEN they reappear

### Requirement: API endpoints

The system MUST expose REST endpoints under `/api/documents/{doc_id}/comments`.

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | /api/documents/{doc_id}/comments | read access | CommentResponse[] flat list with nested replies |
| POST | /api/documents/{doc_id}/comments | read access | CommentResponse (201) |
| POST | /api/documents/{doc_id}/comments/{id}/replies | read access | CommentResponse (reply) |
| PUT | /api/documents/{doc_id}/comments/{id} | comment author | CommentResponse |
| DELETE | /api/documents/{doc_id}/comments/{id} | author or owner | {"message": "Comment deleted"} |
| PATCH | /api/documents/{doc_id}/comments/{id}/resolve | author or owner | CommentResponse (toggled) |

#### Scenario: Comment CRUD via API

- GIVEN I have read access to a document with an existing comment
- WHEN I send requests matching the table above
- THEN the response matches the specified status and shape
- AND create/update endpoints accept `Content: JSON body with "content"` and `block_id` for top-level

#### Scenario: Error responses

- GIVEN a non-existent document ID
- WHEN I send any comment API request
- THEN the response returns 404
- GIVEN a comment that does not exist
- WHEN I send GET/PUT/DELETE/PATCH targeting that ID
- THEN the response returns 404

### Requirement: Data model

The system MUST persist comments in a `comments` table via SQLAlchemy.

#### Scenario: CommentModel schema

- GIVEN a new comment is created
- THEN it stores id (VARCHAR 36 PK), document_id (FK → documents.id CASCADE), block_id (VARCHAR 36), author_id (FK → users.id), content (TEXT), parent_id (nullable FK → comments.id CASCADE), resolved (BOOLEAN DEFAULT FALSE), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

### Requirement: Frontend store

The system MUST provide a Zustand store for comment state management.

#### Scenario: Store operations

- GIVEN a user opens a document
- WHEN the document loads
- THEN fetchComments(docId) retrieves all comments grouped by block_id
- GIVEN a user clicks a comment indicator
- THEN setActiveBlock(blockId) scrolls the sidebar to that thread
- GIVEN the store's visible flag is true
- WHEN toggleVisibility() is called
- THEN visible flips and sidebar/indicators respond accordingly
