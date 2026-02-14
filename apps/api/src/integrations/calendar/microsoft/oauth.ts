import { ConfidentialClientApplication, AccountInfo } from '@azure/msal-node';
import { decryptToken, encryptToken } from '../shared/crypto.js';

export interface MicrosoftCalendarTokens {
  accessToken: string;
  refreshToken: string; // Actually stores serialized account info for MSAL
  tokenExpiresAt: Date;
  tenantId: string;
  userId: string;
  providerEmail?: string;
}

/**
 * Create Microsoft MSAL client instance.
 * Environment variables required:
 * - MICROSOFT_CALENDAR_CLIENT_ID: From Azure Portal App Registration
 * - MICROSOFT_CALENDAR_CLIENT_SECRET: From Azure Portal App Registration
 */
function createMsalClient(): ConfidentialClientApplication {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_CALENDAR_CLIENT_ID and MICROSOFT_CALENDAR_CLIENT_SECRET environment variables are required');
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: 'https://login.microsoftonline.com/common', // Multi-tenant
    },
  });
}

/**
 * Generate Microsoft Calendar authorization URL.
 * User will be redirected to this URL to grant calendar access.
 *
 * @param tenantId - Tenant ID for callback association
 * @param userId - User ID for callback association
 * @returns Authorization URL to redirect user to
 */
export async function getMicrosoftCalendarAuthUrl(tenantId: string, userId: string): Promise<string> {
  const cca = createMsalClient();

  // State parameter carries tenantId and userId for callback
  const state = JSON.stringify({ tenantId, userId });

  const authCodeUrlParameters = {
    scopes: ['Calendars.ReadWrite', 'offline_access', 'User.Read'],
    redirectUri: `${process.env.API_URL}/api/integrations/calendar/microsoft/callback`,
    state,
  };

  return await cca.getAuthCodeUrl(authCodeUrlParameters);
}

/**
 * Exchange authorization code for access and refresh tokens.
 *
 * Note: MSAL manages refresh tokens internally. We serialize the account info
 * to enable token refresh across server restarts.
 *
 * @param code - Authorization code from OAuth callback
 * @param state - State parameter from callback (contains tenantId and userId)
 * @returns Token data with serialized account info
 */
export async function handleMicrosoftCalendarCallback(
  code: string,
  state: string
): Promise<MicrosoftCalendarTokens> {
  const cca = createMsalClient();

  // Parse state to get tenantId and userId
  const { tenantId, userId } = JSON.parse(state);

  const tokenRequest = {
    code,
    scopes: ['Calendars.ReadWrite', 'offline_access', 'User.Read'],
    redirectUri: `${process.env.API_URL}/api/integrations/calendar/microsoft/callback`,
  };

  // Exchange code for tokens
  const response = await cca.acquireTokenByCode(tokenRequest);

  if (!response || !response.accessToken || !response.account) {
    throw new Error('Microsoft OAuth response missing access token or account');
  }

  // MSAL stores refresh tokens in its cache, not directly in the response
  // We serialize the account object to enable acquireTokenSilent later
  const accountInfo = response.account;
  const serializedAccount = JSON.stringify(accountInfo);

  return {
    accessToken: response.accessToken,
    refreshToken: serializedAccount, // Store serialized account for acquireTokenSilent
    tokenExpiresAt: response.expiresOn || new Date(Date.now() + 3600 * 1000),
    tenantId,
    userId,
    providerEmail: accountInfo.username,
  };
}

/**
 * Refresh Microsoft Calendar access token using stored account info.
 *
 * Note: Uses MSAL's acquireTokenSilent which retrieves cached refresh tokens.
 * Microsoft MAY rotate refresh tokens; MSAL handles this automatically.
 *
 * @param encryptedAccountInfo - Encrypted serialized account from database
 * @returns New access token and expiration
 */
export async function refreshMicrosoftCalendarToken(
  encryptedAccountInfo: string
): Promise<{ accessToken: string; tokenExpiresAt: Date; newRefreshToken?: string }> {
  const cca = createMsalClient();

  // Decrypt and deserialize the stored account info
  const accountJson = decryptToken(encryptedAccountInfo);
  const account: AccountInfo = JSON.parse(accountJson);

  const silentRequest = {
    account,
    scopes: ['Calendars.ReadWrite', 'offline_access', 'User.Read'],
  };

  // Acquire token silently (uses cached refresh token)
  const response = await cca.acquireTokenSilent(silentRequest);

  if (!response || !response.accessToken) {
    throw new Error('Microsoft token refresh failed');
  }

  // If account info changed (rare), return updated account
  const newAccountInfo = response.account ? JSON.stringify(response.account) : undefined;

  return {
    accessToken: response.accessToken,
    tokenExpiresAt: response.expiresOn || new Date(Date.now() + 3600 * 1000),
    // Return updated account if it changed
    newRefreshToken: newAccountInfo,
  };
}
