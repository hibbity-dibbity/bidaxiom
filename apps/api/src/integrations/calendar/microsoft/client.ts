import { Client } from '@microsoft/microsoft-graph-client';

/**
 * Create Microsoft Graph API client.
 *
 * @param accessToken - OAuth access token
 * @returns Configured Microsoft Graph client
 *
 * @example
 * const client = createMicrosoftGraphClient(accessToken);
 * const events = await client
 *   .api('/me/calendar/events')
 *   .top(10)
 *   .get();
 */
export function createMicrosoftGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}
