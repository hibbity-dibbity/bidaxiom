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
