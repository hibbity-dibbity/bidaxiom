import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Customers give us addresses the server then contacts (their identity provider). Only public https
 * addresses are allowed, so a connection can't be pointed at our own database, the API, or cloud
 * metadata services. For local testing set SSO_ALLOW_PRIVATE_ISSUERS=true.
 */
function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  if (isIP(v) === 6) return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  const [a, b] = v.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("That address is not a valid URL."); }
  const allowPrivate = process.env.SSO_ALLOW_PRIVATE_ISSUERS === "true";
  if (u.protocol !== "https:" && !(allowPrivate && u.protocol === "http:")) throw new Error("The address must start with https://");
  if (u.username || u.password) throw new Error("The address must not contain a user name or password.");
  if (allowPrivate) return u;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new Error(`Could not find ${host}.`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("That address points inside a private network, which isn't allowed.");
  return u;
}

export async function safeFetchJson<T>(raw: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T }> {
  const u = await assertSafeUrl(raw);
  const res = await fetch(u, { ...init, redirect: "manual", signal: AbortSignal.timeout(8000) });
  if (res.status >= 300 && res.status < 400) throw new Error("The identity provider redirected an API request, which isn't allowed.");
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}
