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

let _presignClient: S3Client | null = null;

/**
 * Client used only to sign links that the browser opens (uploads and downloads). The API reaches
 * storage by its internal address (S3_ENDPOINT, e.g. http://minio:9000), which a browser cannot
 * reach, so signed links use S3_PUBLIC_ENDPOINT when it is set. Unset means the same address.
 */
export function getPresignClient(): S3Client {
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT;
  if (!publicEndpoint) return getStorageClient();
  if (!_presignClient) {
    _presignClient = new S3Client({
      endpoint: publicEndpoint,
      region: process.env.S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
  }
  return _presignClient;
}

/** Reset the client (for testing). */
export function resetStorageClient(): void {
  _s3Client = null;
  _presignClient = null;
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

/**
 * Build an S3 storage key for a company-scoped template file.
 * Templates are NOT project-scoped (no projectId in the path).
 *
 * Format: tenants/{tenantId}/templates/{uuid}/{fileName}
 */
export function buildTemplateStorageKey(tenantId: string, fileName: string): string {
  const prefix = crypto.randomUUID();
  return `tenants/${tenantId}/templates/${prefix}/${fileName}`;
}
