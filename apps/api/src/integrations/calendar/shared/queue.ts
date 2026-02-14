import { Queue } from 'bullmq';
import { redisConnection } from '../../quickbooks/queue.js';  // Reuse same Redis config

// Re-export for worker
export { redisConnection };

export interface CalendarSyncJobData {
  tenantId: string;
  provider: 'google' | 'microsoft';
  connectionId: string;           // calendar_connections.id
  operation: 'full-sync' | 'incremental-sync' | 'push-event' | 'delete-event' | 'renew-webhook';
  projectId?: string;             // For push-event: which project's milestones
  phaseId?: string;               // For push-event: specific phase
  eventId?: string;               // For delete-event: which calendar event
  syncReason: 'webhook' | 'scheduled' | 'manual' | 'project-update';
}

export const calendarSyncQueue = new Queue<CalendarSyncJobData>('calendar-sync', {
  connection: redisConnection,    // Reuse from QBO
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,                // 2s -> 4s -> 8s -> 16s -> 32s
    },
    removeOnComplete: { count: 100, age: 86400 },
    removeOnFail: { count: 500, age: 604800 },
  },
});
