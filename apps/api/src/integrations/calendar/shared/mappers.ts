/**
 * Event mappers for bidirectional sync between platform milestones and calendar events.
 *
 * Platform milestones:
 * - Project start/end dates (from projects table)
 * - Project phase start/end dates (from projectPhases table)
 *
 * Maps to/from:
 * - Google Calendar events
 * - Microsoft Outlook events
 */

export interface InternalCalendarEvent {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay: boolean;
  sourceEntityType?: 'project' | 'project_phase';
  sourceEntityId?: string;
  timezone?: string;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    date?: string;       // YYYY-MM-DD for all-day
    dateTime?: string;   // ISO 8601 for timed
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  status?: string;       // 'confirmed' | 'tentative' | 'cancelled'
  etag?: string;
}

export interface MicrosoftCalendarEvent {
  id?: string;
  subject: string;
  body?: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay?: boolean;
  '@removed'?: {
    reason: string;
  };
}

/**
 * Convert project and phases to internal calendar events.
 *
 * @param project - Project record with startDate and endDate
 * @param phases - Array of project phases with startDate and endDate
 * @returns Array of internal calendar events ready for creation
 */
export function projectToCalendarEvents(
  project: { id: string; name: string; startDate: Date | null; endDate: Date | null },
  phases: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }>
): InternalCalendarEvent[] {
  const events: InternalCalendarEvent[] = [];

  // Project start event
  if (project.startDate) {
    events.push({
      title: `[${project.name}] Project Start`,
      description: `Start of project: ${project.name}`,
      startDate: project.startDate,
      allDay: true,
      sourceEntityType: 'project',
      sourceEntityId: project.id,
    });
  }

  // Project end event
  if (project.endDate) {
    events.push({
      title: `[${project.name}] Project End / Deadline`,
      description: `End/deadline of project: ${project.name}`,
      startDate: project.endDate,
      allDay: true,
      sourceEntityType: 'project',
      sourceEntityId: project.id,
    });
  }

  // Phase events
  for (const phase of phases) {
    if (phase.startDate) {
      events.push({
        title: `[${project.name}] ${phase.name} Start`,
        description: `Start of ${phase.name} phase`,
        startDate: phase.startDate,
        allDay: true,
        sourceEntityType: 'project_phase',
        sourceEntityId: phase.id,
      });
    }

    if (phase.endDate) {
      events.push({
        title: `[${project.name}] ${phase.name} End`,
        description: `End of ${phase.name} phase`,
        startDate: phase.endDate,
        allDay: true,
        sourceEntityType: 'project_phase',
        sourceEntityId: phase.id,
      });
    }
  }

  return events;
}

/**
 * Map Google Calendar event to internal format.
 *
 * @param googleEvent - Google Calendar API event
 * @returns Internal event format or null if cancelled
 */
export function mapGoogleEventToInternal(googleEvent: GoogleCalendarEvent): InternalCalendarEvent | null {
  // Deleted/cancelled events
  if (googleEvent.status === 'cancelled') {
    return null;
  }

  // Determine if all-day (has date field, no dateTime)
  const allDay = !!googleEvent.start.date;

  // Parse dates
  const startDate = allDay
    ? new Date(googleEvent.start.date!)
    : new Date(googleEvent.start.dateTime!);

  const endDate = googleEvent.end
    ? (allDay ? new Date(googleEvent.end.date!) : new Date(googleEvent.end.dateTime!))
    : undefined;

  return {
    title: googleEvent.summary,
    description: googleEvent.description,
    startDate,
    endDate,
    allDay,
    timezone: googleEvent.start.timeZone,
  };
}

/**
 * Map Microsoft Graph event to internal format.
 *
 * @param msEvent - Microsoft Graph event
 * @returns Internal event format or null if deleted
 */
export function mapMicrosoftEventToInternal(msEvent: MicrosoftCalendarEvent): InternalCalendarEvent | null {
  // Deleted events have @removed property
  if (msEvent['@removed']) {
    return null;
  }

  return {
    title: msEvent.subject,
    description: msEvent.body?.content,
    startDate: new Date(msEvent.start.dateTime),
    endDate: new Date(msEvent.end.dateTime),
    allDay: msEvent.isAllDay ?? false,
    timezone: msEvent.start.timeZone,
  };
}

/**
 * Convert internal event to Google Calendar format.
 *
 * @param event - Internal calendar event
 * @returns Google Calendar API event object
 */
export function internalToGoogleEvent(event: InternalCalendarEvent): GoogleCalendarEvent {
  if (event.allDay) {
    // All-day events use 'date' field (YYYY-MM-DD)
    const dateStr = event.startDate.toISOString().split('T')[0];

    // For all-day events, end date is exclusive (next day)
    const endDate = event.endDate || event.startDate;
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDateStr = nextDay.toISOString().split('T')[0];

    return {
      summary: event.title,
      description: event.description,
      start: {
        date: dateStr,
        timeZone: event.timezone || 'America/New_York',
      },
      end: {
        date: endDateStr,
        timeZone: event.timezone || 'America/New_York',
      },
    };
  } else {
    // Timed events use 'dateTime' field (ISO 8601)
    return {
      summary: event.title,
      description: event.description,
      start: {
        dateTime: event.startDate.toISOString(),
        timeZone: event.timezone || 'America/New_York',
      },
      end: {
        dateTime: (event.endDate || event.startDate).toISOString(),
        timeZone: event.timezone || 'America/New_York',
      },
    };
  }
}

/**
 * Convert internal event to Microsoft Graph format.
 *
 * @param event - Internal calendar event
 * @returns Microsoft Graph event object
 */
export function internalToMicrosoftEvent(event: InternalCalendarEvent): Partial<MicrosoftCalendarEvent> {
  return {
    subject: event.title,
    body: event.description ? {
      contentType: 'text',
      content: event.description,
    } : undefined,
    start: {
      dateTime: event.startDate.toISOString(),
      timeZone: event.timezone || 'America/New_York',
    },
    end: {
      dateTime: (event.endDate || event.startDate).toISOString(),
      timeZone: event.timezone || 'America/New_York',
    },
    isAllDay: event.allDay,
  };
}
