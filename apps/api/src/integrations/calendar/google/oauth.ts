import { google } from 'googleapis';
import { decryptToken, encryptToken } from '../shared/crypto.js';

export interface GoogleCalendarTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  tenantId: string;
  userId: string;
  providerEmail?: string;
}

/**
 * Create Google OAuth2 client instance.
 * Environment variables required:
 * - GOOGLE_CALENDAR_CLIENT_ID: From Google Cloud Console
 * - GOOGLE_CALENDAR_CLIENT_SECRET: From Google Cloud Console
 * - API_URL: Base URL for redirect URI
 */
function createGoogleOAuth2Client() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = `${process.env.API_URL}/api/integrations/calendar/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables are required');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google Calendar authorization URL.
 * User will be redirected to this URL to grant calendar access.
 *
 * @param tenantId - Tenant ID for callback association
 * @param userId - User ID for callback association
 * @returns Authorization URL to redirect user to
 */
export function getGoogleCalendarAuthUrl(tenantId: string, userId: string): string {
  const oauth2Client = createGoogleOAuth2Client();

  // State parameter carries tenantId and userId for callback
  const state = JSON.stringify({ tenantId, userId });

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',  // CRITICAL: Enables refresh token
    prompt: 'consent',       // Force consent to guarantee refresh token
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    state,
  });
}

/**
 * Exchange authorization code for access and refresh tokens.
 *
 * @param code - Authorization code from OAuth callback
 * @param state - State parameter from callback (contains tenantId and userId)
 * @returns Token data with expiration times
 */
export async function handleGoogleCalendarCallback(
  code: string,
  state: string
): Promise<GoogleCalendarTokens> {
  const oauth2Client = createGoogleOAuth2Client();

  // Parse state to get tenantId and userId
  const { tenantId, userId } = JSON.parse(state);

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Google OAuth response missing required tokens');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: new Date(tokens.expiry_date),
    tenantId,
    userId,
    providerEmail: tokens.id_token ? undefined : undefined, // Email would require id_token decoding
  };
}

/**
 * Refresh Google Calendar access token using refresh token.
 * Note: Google does NOT rotate refresh tokens (unlike QuickBooks/Microsoft).
 * The same refresh token can be reused indefinitely.
 *
 * @param encryptedRefreshToken - Encrypted refresh token from database
 * @returns New access token and expiration (refresh token stays the same)
 */
export async function refreshGoogleCalendarToken(
  encryptedRefreshToken: string
): Promise<{ accessToken: string; tokenExpiresAt: Date }> {
  const oauth2Client = createGoogleOAuth2Client();

  // Decrypt the stored refresh token
  const refreshToken = decryptToken(encryptedRefreshToken);

  // Set refresh token on client
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Refresh to get new access token
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Google token refresh failed');
  }

  return {
    accessToken: credentials.access_token,
    tokenExpiresAt: new Date(credentials.expiry_date),
    // Google does NOT rotate refresh tokens - reuse existing
  };
}
