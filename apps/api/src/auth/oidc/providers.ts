import { createRemoteJWKSet, jwtVerify } from "jose";
import { assertSafeUrl, safeFetchJson } from "./net.js";

/**
 * Generic OpenID Connect. Every company registers its own app with its own identity provider and
 * gives BidAxiom the issuer address, client id and client secret. Presets only help build the
 * issuer address; the sign-in itself is the same for Microsoft, Google, Okta, Auth0, Keycloak...
 */
export const PRESETS = [
  { key: "microsoft", label: "Microsoft (Entra ID)", field: { name: "tenantId", label: "Directory (tenant) ID", help: "From your app registration's Overview page." } },
  { key: "google", label: "Google Workspace", field: null },
  { key: "oidc", label: "Other (Okta, Auth0, Keycloak, ...)", field: { name: "issuer", label: "Issuer URL", help: "For example https://yourcompany.okta.com" } },
] as const;

export function issuerFor(preset: string, value: string | undefined): string {
  const v = (value ?? "").trim().replace(/\/+$/, "");
  if (preset === "microsoft") {
    if (!/^[0-9a-zA-Z.-]{3,100}$/.test(v)) throw new Error("Enter the directory (tenant) ID from your Microsoft app registration.");
    return `https://login.microsoftonline.com/${v}/v2.0`;
  }
  if (preset === "google") return "https://accounts.google.com";
  if (preset === "oidc") {
    if (!v) throw new Error("Enter the issuer URL from your identity provider.");
    return v;
  }
  throw new Error("Unknown provider");
}

interface Discovery { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }
const discoveryCache = new Map<string, { at: number; d: Discovery }>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function discover(issuer: string): Promise<Discovery> {
  const hit = discoveryCache.get(issuer);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.d;
  const r = await safeFetchJson<Partial<Discovery>>(`${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`);
  const d = r.body;
  if (!r.ok || !d.issuer || !d.authorization_endpoint || !d.token_endpoint || !d.jwks_uri) {
    throw new Error("Could not read the identity provider's settings. Check the issuer address.");
  }
  await Promise.all([assertSafeUrl(d.authorization_endpoint), assertSafeUrl(d.token_endpoint), assertSafeUrl(d.jwks_uri)]);
  const full = d as Discovery;
  discoveryCache.set(issuer, { at: Date.now(), d: full });
  return full;
}

export interface OidcIdentity { subject: string; email: string | null; name: string | null }

export interface ConnectionCreds { issuer: string; clientId: string; clientSecret: string }

export async function authorizeUrl(c: { issuer: string; clientId: string }, p: { redirectUri: string; state: string; nonce: string; codeChallenge: string; loginHint?: string }) {
  const d = await discover(c.issuer);
  const q = new URLSearchParams({
    client_id: c.clientId, response_type: "code", redirect_uri: p.redirectUri, scope: "openid profile email",
    state: p.state, nonce: p.nonce, code_challenge: p.codeChallenge, code_challenge_method: "S256",
  });
  if (p.loginHint) q.set("login_hint", p.loginHint);
  return `${d.authorization_endpoint}${d.authorization_endpoint.includes("?") ? "&" : "?"}${q.toString()}`;
}

export async function exchange(c: ConnectionCreds, p: { code: string; redirectUri: string; codeVerifier: string; nonce: string }): Promise<OidcIdentity> {
  const d = await discover(c.issuer);
  const res = await safeFetchJson<{ id_token?: string; error_description?: string; error?: string }>(d.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code: p.code, redirect_uri: p.redirectUri,
      client_id: c.clientId, client_secret: c.clientSecret, code_verifier: p.codeVerifier,
    }),
  });
  if (!res.ok || !res.body.id_token) {
    throw new Error((res.body.error_description ?? res.body.error ?? "The identity provider did not accept the sign-in").split(/\r|\n/)[0]);
  }
  let jwks = jwksCache.get(d.jwks_uri);
  if (!jwks) { jwks = createRemoteJWKSet(new URL(d.jwks_uri)); jwksCache.set(d.jwks_uri, jwks); }
  const { payload } = await jwtVerify(res.body.id_token, jwks, { issuer: d.issuer, audience: c.clientId });
  if (payload.nonce !== p.nonce) throw new Error("Sign-in response did not match the request");
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  if (!subject) throw new Error("The identity provider did not return a user id");
  const email = typeof payload.email === "string" ? payload.email : typeof payload.preferred_username === "string" ? payload.preferred_username : null;
  // Google tells us when an address is unverified; never trust one that says so.
  const unverified = payload.email_verified === false;
  return {
    subject,
    email: email && email.includes("@") && !unverified ? email.toLowerCase() : null,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}
