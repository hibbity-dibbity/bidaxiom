import { S3Client, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

/**
 * Lazy-initialized S3-compatible storage client.
 * Works with MinIO (local dev) or AWS S3 / any S3-compatible provider (production).
 * Deferred initialization follows the same pattern as database pool (db/client.ts).
 */
let _s3Client: S3Client | null = null;

export function getStorageClient(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // Required for MinIO; harmless for AWS S3
    });
  }
  return _s3Client;
}

/** Reset the client (for testing). */
export function resetStorageClient(): void {
  _s3Client = null;
}

/**
 * Get the configured bucket name from environment.
 */
export function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error("S3_BUCKET_NAME environment variable is not set");
  }
  return bucket;
}

/**
 * Ensure the storage bucket exists. Create it if it doesn't.
 * Called during server startup to auto-create the bucket in local dev.
 */
export async function ensureBucket(): Promise<void> {
  const s3 = getStorageClient();
  const bucket = getBucketName();

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: unknown) {
    const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      console.log(`Creating S3 bucket: ${bucket}`);
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`S3 bucket created: ${bucket}`);
    } else {
      console.warn("S3 bucket check failed (MinIO may not be running):", (err as Error).message);
    }
  }
}

/**
 * Build a tenant-isolated S3 object key.
 * CRITICAL: Always include tenantId to prevent cross-tenant document access.
 *
 * Format: tenants/{tenantId}/projects/{projectId}/{uuid}/{fileName}
 */
export function buildStorageKey(
  tenantId: string,
  projectId: string,
  fileName: string
): string {
  // Generate a UUID prefix to prevent name collisions and enumeration
  const prefix = crypto.randomUUID();
  return `tenants/${tenantId}/projects/${projectId}/${prefix}/${fileName}`;
}
