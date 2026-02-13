import QuickBooks from 'node-quickbooks';

/**
 * Create a QuickBooks API client instance.
 * @param accessToken - OAuth access token
 * @param realmId - QuickBooks company ID
 * @returns Configured QuickBooks client
 */
export function createQboClient(accessToken: string, realmId: string): any {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const environment = process.env.QBO_ENVIRONMENT || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('QBO_CLIENT_ID and QBO_CLIENT_SECRET environment variables are required');
  }

  return new QuickBooks(
    clientId,
    clientSecret,
    accessToken,
    false, // No token secret (OAuth 2.0)
    realmId,
    environment === 'sandbox', // useSandbox
    false, // debug
    75, // minorversion (MANDATORY - versions < 75 deprecated since Aug 2025)
    '2.0', // oauthversion
    null // refreshToken (not needed for client creation, handled separately)
  );
}

/**
 * Promisify node-quickbooks callback-style methods.
 * node-quickbooks uses (err, result) => void callbacks.
 *
 * @param qboMethod - QuickBooks method (bound to instance)
 * @param args - Arguments to pass to the method
 * @returns Promise that resolves with result or rejects with error
 *
 * @example
 * const qbo = createQboClient(accessToken, realmId);
 * const customer = await promisifyQbo<Customer>(qbo.getCustomer.bind(qbo), customerId);
 */
export function promisifyQbo<T>(qboMethod: Function, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    qboMethod(...args, (err: Error | null, result: T) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}
