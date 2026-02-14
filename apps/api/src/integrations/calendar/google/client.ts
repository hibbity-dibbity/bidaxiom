import { google } from 'googleapis';

/**
 * Create Google Calendar API client.
 *
 * @param accessToken - OAuth access token
 * @returns Configured Google Calendar v3 client
 *
 * @example
 * const calendar = createGoogleCalendarClient(accessToken);
 * const events = await calendar.events.list({
 *   calendarId: 'primary',
 *   timeMin: new Date().toISOString(),
 *   maxResults: 10,
 * });
 */
export function createGoogleCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();

  // Set the access token
  oauth2Client.setCredentials({ access_token: accessToken });

  // Return configured calendar client (v3)
  return google.calendar({ version: 'v3', auth: oauth2Client });
}
