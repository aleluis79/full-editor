# Image Insert Dialog Specification

## Purpose

Provide a toolbar button that opens a file picker for selecting images from disk, then uploads and inserts them as Image blocks in the document.

## Requirements

### Requirement: Toolbar button for image insertion

The editor toolbar MUST include an image insert button. When clicked, it MUST open a native file picker (`<input type="file" accept="image/*">`). If the user cancels the picker without selecting a file, the system MUST take no action.

#### Scenario: Click toolbar button and select image

- GIVEN the editor toolbar is rendered
- WHEN the user clicks the image insert button
- THEN a file picker dialog opens with `accept="image/*"`

#### Scenario: User cancels file picker

- GIVEN the file picker is open
- WHEN the user clicks Cancel without selecting a file
- THEN no action is taken and the editor remains unchanged

### Requirement: File validation on selection

The system MUST validate selected files: reject files exceeding 10MB, reject non-image types, and accept only PNG, JPEG, GIF, and WebP. On validation failure, the system MUST show an error message and MUST NOT upload.

#### Scenario: Selected file exceeds size limit

- GIVEN the user opens the file picker
- WHEN they select a 12MB image
- THEN the system detects the file exceeds 10MB
- AND shows an error: "Image must be under 10MB"
- AND does NOT upload the file

#### Scenario: Selected file has unsupported format

- GIVEN the user opens the file picker
- WHEN they select a BMP file
- THEN the system detects the format is not supported
- AND shows an error: "Only PNG, JPEG, GIF, and WebP images are supported"
- AND does NOT upload the file

### Requirement: Upload and insert image

On successful validation, the system MUST POST the image as multipart/form-data to `/api/images/upload`, await the returned URL, and call the existing `insertImage` store action to create an Image block at the current cursor position. On upload failure, the system MUST show an error and MUST NOT insert a block.

#### Scenario: Image upload succeeds

- GIVEN the user selected a valid JPEG from the file picker
- WHEN validation passes
- THEN the system sends a POST request to `/api/images/upload`
- AND receives `{ "url": "/uploads/images/xyz789.jpg" }`
- AND calls `insertImage("/uploads/images/xyz789.jpg")`
- AND the Image block renders in the document

#### Scenario: Upload fails with network error

- GIVEN the user selected a valid image
- WHEN the upload request fails (network timeout)
- THEN the system shows "Failed to upload image. Please try again."
- AND does NOT insert an Image block

### Requirement: Shared upload flow

Both paste and file-picker insertion MUST delegate to the same `uploadAndInsertImage` function, sharing upload logic, validation, and error handling. This function MUST NOT be coupled to clipboard or file-picker event specifics.

#### Scenario: Paste and dialog use same flow

- GIVEN `uploadAndInsertImage` is defined as a shared function
- WHEN either paste or toolbar insertion triggers an upload
- THEN both paths call the same function with the same validation and upload logic
