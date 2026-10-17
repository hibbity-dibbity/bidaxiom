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

/** A problem QuickBooks reported that retrying cannot fix (for example a rule about the record). Carries words a person can act on. */
export class QboUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QboUserError';
  }
}

/** The readable part of a QuickBooks error: "message: detail" from its Fault, whichever shape the library handed back. */
export function qboFaultText(err: unknown): string | null {
  const e = err as any;
  const fault = e?.Fault ?? e?.response?.data?.Fault ?? e?.body?.Fault ?? e?.error?.Fault;
  const f = fault?.Error?.[0];
  if (!f) return null;
  const parts = [f.Message, f.Detail].filter(Boolean).map(String);
  return parts.length ? parts.join(': ') : null;
}

/** The first Fault of a QuickBooks error, whichever shape the library handed back. */
export function qboFaultOf(err: unknown): { code?: string; message: string; detail?: string } | null {
  const e = err as any;
  const fault = e?.Fault ?? e?.response?.data?.Fault ?? e?.body?.Fault ?? e?.error?.Fault;
  const f = fault?.Error?.[0];
  return f ? { code: f.code ? String(f.code) : undefined, message: String(f.Message ?? ''), detail: f.Detail ? String(f.Detail) : undefined } : null;
}

/** True when QuickBooks says the record it was asked about is gone (deleted, or never existed). */
export function qboIsNotFound(err: unknown): boolean {
  const f = qboFaultOf(err);
  if (f) return f.code === '610' || /not found|has been deleted|does not exist/i.test(`${f.message} ${f.detail ?? ''}`);
  return false;
}

const QBO_BASE: Record<string, string> = {
  production: 'https://quickbooks.api.intuit.com',
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
};

/** Escape a value for use inside single quotes in a QuickBooks query. */
export function qboQuote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Run a read-only QuickBooks query (select ...) and return the matching rows of one entity type.
 * Used to find records that already exist before creating anything.
 */
export async function qboQueryRows<T = any>(accessToken: string, realmId: string, entity: string, sql: string): Promise<T[]> {
  const base = QBO_BASE[process.env.QBO_ENVIRONMENT || 'sandbox'] ?? QBO_BASE.sandbox;
  const res = await fetch(`${base}/v3/company/${realmId}/query?query=${encodeURIComponent(sql)}&minorversion=75`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`QuickBooks query failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data: any = await res.json();
  return (data.QueryResponse?.[entity] ?? []) as T[];
}
