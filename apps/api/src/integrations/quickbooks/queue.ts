import { Queue, ConnectionOptions } from 'bullmq';

/**
 * Sync job data structure.
 * Defines what information is needed to process a QBO sync job.
 */
export interface QboSyncJobData {
  tenantId: string;
  entityType: 'project' | 'invoice' | 'bill' | 'payment' | 'vendor' | 'customer';
  platformId?: string;    // For platform-to-QBO sync
  qboId?: string;         // For QBO-to-platform sync
  operation?: 'Create' | 'Update' | 'Delete' | 'Void';
  syncReason: 'webhook' | 'cdc' | 'manual' | 'auto';
}

/**
 * Redis connection configuration for BullMQ.
 * Shared across queue and workers.
 */
export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required by BullMQ
};

/**
 * QuickBooks Online sync queue — lazy getter.
 * Defers Redis connection until first use so the server can start without Redis.
 *
 * Configuration:
 * - 5 retry attempts with exponential backoff (2s, 4s, 8s, 16s, 32s)
 * - Completed jobs retained for 1 day or last 100 jobs
 * - Failed jobs retained for 1 week or last 500 jobs
 */
let _qboSyncQueue: Queue<QboSyncJobData> | null = null;

export function getQboSyncQueue(): Queue<QboSyncJobData> {
  if (!_qboSyncQueue) {
    _qboSyncQueue = new Queue<QboSyncJobData>('qbo-sync', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start at 2 seconds, doubles each retry
        },
        removeOnComplete: { count: 100, age: 86400 },  // Keep 100 or 1 day (in seconds)
        removeOnFail: { count: 500, age: 604800 },      // Keep 500 or 1 week (in seconds)
      },
    });
  }
  return _qboSyncQueue;
}
