# Image Paste Specification

## Purpose

Handle clipboard paste events containing images — detect image data in the clipboard, validate, upload to backend, and insert as an Image block in the document.

## Requirements

### Requirement: Clipboard image detection

When the user triggers a paste event (Ctrl+V / Cmd+V), the paste handler MUST inspect `clipboardData.files` and `clipboardData.items` for entries with image MIME types (`image/png`, `image/jpeg`, `image/gif`, `image/webp`). If found, the handler MUST intercept the paste and start the upload flow instead of inserting raw text. If no image data is found, the paste MUST fall through to the normal text paste handler.

#### Scenario: Paste PNG image from clipboard

- GIVEN the user has a PNG image in the clipboard
- WHEN they press Ctrl+V in the editor
- THEN the paste handler detects the image in `clipboardData.files`
- AND initiates the upload flow without inserting raw clipboard text

#### Scenario: Paste non-image content

- GIVEN the user has plain text in the clipboard
- WHEN they press Ctrl+V in the editor
- THEN the paste handler finds no image MIME types
- AND falls through to the existing text paste handler

#### Scenario: Paste from clipboardData.items (Chromium)

- GIVEN the user has a WebP image copied from a web page
- WHEN they press Ctrl+V in the editor
- THEN the paste handler detects `clipboardData.items` with `kind: "file"` and `type: "image/webp"`
- AND initiates the upload flow

### Requirement: File validation on paste

Before uploading, the system MUST validate the pasted image: reject files exceeding 10MB, reject non-image MIME types, and accept only PNG, JPEG, GIF, and WebP formats. On validation failure, the system MUST show a user-facing error message and MUST NOT upload the file.

#### Scenario: Pasted image exceeds size limit

- GIVEN the user has a 15MB JPEG in the clipboard
- WHEN they paste it into the editor
- THEN the system detects the file exceeds 10MB
- AND shows an error: "Image must be under 10MB"
- AND does NOT upload the file

#### Scenario: Pasted file is not an image

- GIVEN the user has a PDF file in the clipboard
- WHEN they paste it into the editor
- THEN the system detects the MIME type is not an image
- AND shows an error: "Only PNG, JPEG, GIF, and WebP images are supported"
- AND does NOT upload the file

### Requirement: Upload and insert image

On successful validation, the system MUST POST the image as multipart/form-data to the backend upload endpoint, await the returned URL, and call the existing `insertImage` store action with that URL to create an Image block at the current cursor position. On upload failure, the system MUST show an error and MUST NOT insert a block.

#### Scenario: Image upload succeeds

- GIVEN the user pastes a valid PNG image
- WHEN validation passes
- THEN the system sends a POST request with the file to `/api/images/upload`
- AND receives `{ "url": "/uploads/images/abc123.png" }` in response
- AND calls `insertImage("/uploads/images/abc123.png")`
- AND the Image block renders in the document

#### Scenario: Image upload fails with server error

- GIVEN the user pastes a valid image
- WHEN the POST request returns a 5xx error
- THEN the system shows "Failed to upload image. Please try again."
- AND does NOT insert an Image block
