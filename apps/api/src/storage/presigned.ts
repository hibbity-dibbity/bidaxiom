import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageClient, getBucketName, buildStorageKey } from "./client.js";

/**
 * Generate a pre-signed URL for client-side file upload.
 * The URL expires in 15 minutes. The client uploads directly to S3
 * without proxying through the API server.
 *
 * @returns uploadUrl (PUT to this URL), storageKey (save in DB)
 */
export async function generateUploadUrl(
  tenantId: string,
  projectId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; storageKey: string }> {
  const s3 = getStorageClient();
  const bucket = getBucketName();
  const key = buildStorageKey(tenantId, projectId, fileName);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 minutes

  return { uploadUrl, storageKey: key };
}

/**
 * Generate a pre-signed URL for file download.
 * The URL expires in 1 hour for viewing/downloading documents.
 *
 * @param storageKey - The S3 object key stored in the documents table
 * @param fileName - Original file name (used for Content-Disposition header)
 * @returns downloadUrl (GET from this URL)
 */
export async function generateDownloadUrl(
  storageKey: string,
  fileName?: string
): Promise<string> {
  const s3 = getStorageClient();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ...(fileName ? { ResponseContentDisposition: `attachment; filename="${fileName}"` } : {}),
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Generate a pre-signed URL for company logo upload.
 * The URL expires in 15 minutes.
 *
 * @param tenantId - Tenant ID for storage key isolation
 * @param fileExtension - File extension (png, jpg, svg, etc.)
 * @returns uploadUrl (PUT to this URL), storageKey (save in DB)
 */
export async function generateLogoUploadUrl(
  tenantId: string,
  fileExtension: string
): Promise<{ uploadUrl: string; storageKey: string }> {
  const s3 = getStorageClient();
  const bucket = getBucketName();
  const storageKey = `tenants/${tenantId}/branding/logo.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: `image/${fileExtension === "svg" ? "svg+xml" : fileExtension}`,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 minutes

  return { uploadUrl, storageKey };
}

/**
 * Generate a pre-signed URL for logo download.
 * The URL expires in 1 hour.
 *
 * @param storageKey - The S3 object key stored in company_profiles
 * @returns downloadUrl (GET from this URL)
 */
export async function generateLogoDownloadUrl(
  storageKey: string
): Promise<string> {
  const s3 = getStorageClient();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Delete logo from S3 storage.
 *
 * @param storageKey - The S3 object key to delete
 */
export async function deleteLogoFromStorage(
  storageKey: string
): Promise<void> {
  const s3 = getStorageClient();
  const bucket = getBucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  await s3.send(command);
}
