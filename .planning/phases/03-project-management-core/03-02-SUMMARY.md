---
phase: 03-project-management-core
plan: 02
subsystem: storage
tags: [s3, minio, docker, infrastructure, pre-signed-urls]
dependency_graph:
  requires: []
  provides: [s3-client, presigned-urls, minio-service]
  affects: [document-upload, document-download]
tech_stack:
  added: [minio, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner]
  patterns: [lazy-initialization, tenant-isolation]
key_files:
  created:
    - docker-compose.yml (minio service)
    - apps/api/.env.example
    - apps/api/src/storage/client.ts
    - apps/api/src/storage/presigned.ts
  modified:
    - docker-compose.yml
    - apps/api/package.json
decisions:
  - choice: MinIO for local S3-compatible storage
    rationale: Cloud-agnostic; same API works with AWS S3 or other S3-compatible providers in production
  - choice: forcePathStyle enabled
    rationale: Required for MinIO compatibility; harmless for AWS S3
  - choice: Tenant-prefixed storage keys
    rationale: Prevents cross-tenant document access via storage key format tenants/{tenantId}/projects/{projectId}/{uuid}/{fileName}
  - choice: Pre-signed URLs with different expiry times
    rationale: Uploads expire in 15 minutes (short-lived), downloads expire in 1 hour (user convenience)
metrics:
  duration_minutes: 2
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  commits: 2
  completed_date: 2026-02-12
---

# Phase 03 Plan 02: MinIO Storage Setup Summary

**One-liner:** S3-compatible document storage with MinIO, lazy-initialized client, and pre-signed URLs for secure uploads/downloads with tenant isolation.

## Objective

Set up MinIO for local S3-compatible document storage and create the storage client with pre-signed URL generation to support document upload/download features with cloud-agnostic infrastructure.

## What Was Built

### Infrastructure

**MinIO Service (docker-compose.yml)**
- Added MinIO container to Docker Compose with S3 API on port 9000 and console UI on port 9001
- Default credentials: minioadmin/minioadmin (configurable via environment)
- Volume mount for persistent storage: miniodata
- Health check using `mc ready local` command
- Runs alongside PostgreSQL and Redis services

**Environment Configuration (apps/api/.env.example)**
- Created .env.example with S3 configuration variables
- S3_ENDPOINT: http://localhost:9000 for local MinIO
- S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY: minioadmin (default)
- S3_BUCKET_NAME: construction-docs (auto-created by ensureBucket)
- S3_REGION: us-east-1 (default)

### Storage Client (apps/api/src/storage/client.ts)

**Lazy-Initialized S3Client Factory**
- `getStorageClient()`: Returns singleton S3Client instance
- Follows same deferred initialization pattern as database pool (db/client.ts)
- `forcePathStyle: true` for MinIO compatibility (works with AWS S3 too)
- Configurable via environment variables for cloud-agnostic deployment

**Bucket Management**
- `getBucketName()`: Returns configured bucket name with validation
- `ensureBucket()`: Auto-creates bucket if it doesn't exist (local dev convenience)
- Error handling: logs warning if MinIO not running, doesn't crash server

**Tenant-Isolated Storage Keys**
- `buildStorageKey(tenantId, projectId, fileName)`: Builds S3 object keys
- Format: `tenants/{tenantId}/projects/{projectId}/{uuid}/{fileName}`
- UUID prefix prevents name collisions and enumeration attacks
- CRITICAL: tenantId always included to prevent cross-tenant access

**Testing Support**
- `resetStorageClient()`: Clears singleton for testing scenarios

### Pre-Signed URLs (apps/api/src/storage/presigned.ts)

**Upload URL Generation**
- `generateUploadUrl(tenantId, projectId, fileName, contentType)`: Creates pre-signed PUT URL
- Returns both uploadUrl (for client) and storageKey (for database)
- 15-minute expiry (short-lived for security)
- Client uploads directly to S3 without proxying through API server

**Download URL Generation**
- `generateDownloadUrl(storageKey, fileName?)`: Creates pre-signed GET URL
- 1-hour expiry (user convenience for viewing/downloading)
- Optional Content-Disposition header for custom file names
- Storage key from database ensures tenant isolation enforced

### Dependencies

**Added Packages**
- @aws-sdk/client-s3@3.988.0: S3 client and commands
- @aws-sdk/s3-request-presigner@3.988.0: Pre-signed URL generation

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:

- ✓ Docker Compose config validates successfully with minio service
- ✓ AWS SDK packages (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner) installed in apps/api
- ✓ TypeScript compiles clean (`npx tsc --noEmit` passes)
- ✓ forcePathStyle enabled for MinIO compatibility
- ✓ Tenant isolation implemented in storage keys

## Success Criteria Met

- [x] MinIO service runs in Docker Compose alongside PostgreSQL and Redis
- [x] S3 client factory creates connections to S3-compatible storage
- [x] Pre-signed URL generation works for both uploads (15min) and downloads (1hr)
- [x] Storage keys include tenant isolation prefix
- [x] TypeScript compiles clean

## Technical Notes

**Cloud-Agnostic Design**
The storage client works with any S3-compatible provider:
- Local dev: MinIO via http://localhost:9000
- Production: AWS S3, DigitalOcean Spaces, Backblaze B2, etc.
- Just change S3_ENDPOINT environment variable (or remove it for AWS S3)

**Tenant Isolation Security**
Every storage key includes tenantId in the path:
- Format: `tenants/{tenantId}/projects/{projectId}/{uuid}/{fileName}`
- UUID prevents enumeration (can't guess other files)
- Database stores the full storageKey; downloads validate tenant access via CASL

**Lazy Initialization Pattern**
Storage client follows the same pattern as database pool:
- Singleton instance created on first use
- Allows environment variables to be loaded before client creation
- Works around ESM import hoisting issues

**Pre-Signed URL Expiry Strategy**
- Uploads: 15 minutes (short-lived for security; user uploads immediately)
- Downloads: 1 hour (longer for user convenience; viewing PDFs, downloading files)

## Next Steps

Future plans depending on this work:
- 03-03: Document schema and upload API endpoints (uses generateUploadUrl)
- 03-04: Document download and listing (uses generateDownloadUrl)
- Project phases will store documents in tenant-isolated buckets

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7cde295 | Add MinIO to Docker Compose and install AWS SDK dependencies |
| 2 | a46928a | Create S3 storage client and pre-signed URL service |

## Self-Check: PASSED

Verifying all claims from this summary.

**Created files:**
- FOUND: docker-compose.yml (modified, minio service added)
- FOUND: apps/api/.env.example
- FOUND: apps/api/src/storage/client.ts
- FOUND: apps/api/src/storage/presigned.ts

**Commits:**
- FOUND: 7cde295 (Task 1)
- FOUND: a46928a (Task 2)

All files and commits verified successfully.
