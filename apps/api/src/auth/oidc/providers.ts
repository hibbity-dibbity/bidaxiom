import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * OpenID Connect providers. Each provider adapter knows how to build its sign-in URL, trade the
 * returned code for an ID token, and read a normalized identity from it. Adding Google, Okta and
 * so on later means adding an adapter here and its credentials; the flow and settings are shared.
 */

export interface OidcIdentity {
  /** the provider's stable id for this person inside the customer's directory */
  subject: string;
  /** the customer's directory id (Entra tenant id); binds sign-ins to one company */
  tenantRef: string;
  email: string | null;
  name: string | null;
}

export interface AuthorizeParams {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  loginHint?: string;
}

export interface ProviderAdapter {
  key: string;
  label: string;
  /** false until the BidAxiom-wide client credentials are set in the environment */
  configured(): boolean;
  authorizeUrl(p: AuthorizeParams): string;
  exchange(p: { code: string; redirectUri: string; codeVerifier: string; nonce: string }): Promise<OidcIdentity>;
}

const MS_AUTHORITY = "https://login.microsoftonline.com/organizations";
let msJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const microsoft: ProviderAdapter = {
  key: "microsoft",
  label: "Microsoft",
  configured: () => Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),

  authorizeUrl(p) {
    const q = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      response_type: "code",
      redirect_uri: p.redirectUri,
      response_mode: "query",
      scope: "openid profile email",
      state: p.state,
      nonce: p.nonce,
      code_challenge: p.codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    if (p.loginHint) q.set("login_hint", p.loginHint);
    return `${MS_AUTHORITY}/oauth2/v2.0/authorize?${q.toString()}`;
  },

  async exchange(p) {
    const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
    const res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
        grant_type: "authorization_code",
        code: p.code,
        redirect_uri: p.redirectUri,
        code_verifier: p.codeVerifier,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id_token?: string; error_description?: string };
    if (!res.ok || !body.id_token) {
      throw new Error(body.error_description?.split("\r")[0] ?? "Microsoft did not accept the sign-in");
    }
    msJwks ??= createRemoteJWKSet(new URL("https://login.microsoftonline.com/organizations/discovery/v2.0/keys"));
    // Signature and audience first; then the issuer must be the token's own directory.
    const { payload } = await jwtVerify(body.id_token, msJwks, { audience: clientId });
    const tid = typeof payload.tid === "string" ? payload.tid : "";
    if (!tid || payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) throw new Error("Unexpected token issuer");
    if (payload.nonce !== p.nonce) throw new Error("Sign-in response did not match the request");
    const subject = String(payload.oid ?? payload.sub ?? "");
    if (!subject) throw new Error("Microsoft did not return a user id");
    const emailClaim = typeof payload.email === "string" ? payload.email : typeof payload.preferred_username === "string" ? payload.preferred_username : null;
    return {
      subject,
      tenantRef: tid,
      email: emailClaim && emailClaim.includes("@") ? emailClaim.toLowerCase() : null,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  },
};

const PROVIDERS: Record<string, ProviderAdapter> = { microsoft };

export function getProvider(key: string): ProviderAdapter | null {
  return PROVIDERS[key] ?? null;
}

export function listProviders(): Array<{ key: string; label: string; configured: boolean }> {
  return Object.values(PROVIDERS).map((p) => ({ key: p.key, label: p.label, configured: p.configured() }));
}
