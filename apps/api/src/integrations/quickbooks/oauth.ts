import OAuthClient from 'intuit-oauth';
import { decryptToken } from './crypto.js';

export interface QboTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  realmId?: string;
}

/**
 * Create OAuth client instance.
 * Environment: 'sandbox' or 'production' (from QBO_ENVIRONMENT)
 */
function createOAuthClient(): any {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = `${process.env.API_URL}/api/integrations/quickbooks/callback`;
  const environment = process.env.QBO_ENVIRONMENT || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('QBO_CLIENT_ID and QBO_CLIENT_SECRET environment variables are required');
  }

  return new OAuthClient({
    clientId,
    clientSecret,
    environment,
    redirectUri,
  });
}

/**
 * Generate QuickBooks Online authorization URL.
 * @param tenantId - Tenant ID to link authorization (passed as state parameter)
 * @returns Authorization URL to redirect user to
 */
export function getQboAuthUrl(tenantId: string): string {
  const oauthClient = createOAuthClient();

  // Scopes: com.intuit.quickbooks.accounting for full accounting access, openid for user info
  const authUri = oauthClient.authorizeUri({
    scope: [(OAuthClient as any).scopes.Accounting, (OAuthClient as any).scopes.OpenId],
    state: tenantId, // Pass tenantId as state for callback linking
  });

  return authUri;
}

/**
 * Exchange authorization code for access and refresh tokens.
 * @param code - Authorization code from OAuth callback
 * @param realmId - QuickBooks company ID (from OAuth callback)
 * @param tenantId - Tenant ID (from state parameter validation)
 * @returns Token data with expiration times
 */
export async function handleQboCallback(
  code: string,
  realmId: string,
  tenantId: string
): Promise<QboTokens> {
  const oauthClient = createOAuthClient();

  // Exchange authorization code for tokens
  const authResponse = await oauthClient.createToken(code);
  const token = authResponse.getJson();

  // Calculate expiration dates
  const now = new Date();
  const tokenExpiresAt = new Date(now.getTime() + token.expires_in * 1000);
  const refreshTokenExpiresAt = new Date(now.getTime() + token.x_refresh_token_expires_in * 1000);

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenExpiresAt,
    refreshTokenExpiresAt,
    realmId,
  };
}

/**
 * Refresh access token using refresh token.
 * IMPORTANT: QuickBooks rotates refresh tokens on each refresh.
 * The new refresh token MUST be stored, as the old one becomes invalid.
 *
 * @param encryptedRefreshToken - Encrypted refresh token from database
 * @returns New token data with rotated refresh token
 */
export async function refreshQboToken(encryptedRefreshToken: string): Promise<QboTokens> {
  const oauthClient = createOAuthClient();

  // Decrypt the stored refresh token
  const refreshToken = decryptToken(encryptedRefreshToken);

  // Set the refresh token on the client
  oauthClient.setToken({
    refresh_token: refreshToken,
  });

  // Refresh to get new tokens
  const authResponse = await oauthClient.refresh();
  const token = authResponse.getJson();

  // Calculate expiration dates
  const now = new Date();
  const tokenExpiresAt = new Date(now.getTime() + token.expires_in * 1000);
  const refreshTokenExpiresAt = new Date(now.getTime() + token.x_refresh_token_expires_in * 1000);

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token, // CRITICAL: This is a NEW refresh token (rotation)
    tokenExpiresAt,
    refreshTokenExpiresAt,
  };
}
