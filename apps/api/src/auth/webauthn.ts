import { SignJWT, jwtVerify } from "jose";
import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify as cryptoVerify, type JsonWebKey } from "node:crypto";

/**
 * Passkeys (WebAuthn), implemented directly on node:crypto so there is no extra dependency to keep patched.
 * Scope: "none" attestation (we only need the public key), user verification always required,
 * ES256 / RS256 / EdDSA keys. Every check the WebAuthn spec asks of a relying party for those cases is here.
 */

// ---------------------------------------------------------------- small helpers
export const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
export const fromB64u = (s: string) => Buffer.from(s, "base64url");

// ---------------------------------------------------------------- minimal CBOR (enough for WebAuthn)
type Cbor = number | bigint | string | boolean | null | Buffer | Cbor[] | Map<Cbor, Cbor>;

function cborDecodeAt(buf: Buffer, start: number): { value: Cbor; end: number } {
  let pos = start;
  const need = (n: number) => { if (pos + n > buf.length) throw new Error("Truncated CBOR"); };
  need(1);
  const initial = buf[pos++];
  const major = initial >> 5;
  const info = initial & 31;
  const readLen = (): number => {
    if (info < 24) return info;
    if (info === 24) { need(1); return buf[pos++]; }
    if (info === 25) { need(2); const v = buf.readUInt16BE(pos); pos += 2; return v; }
    if (info === 26) { need(4); const v = buf.readUInt32BE(pos); pos += 4; return v; }
    throw new Error("Unsupported CBOR length");
  };
  switch (major) {
    case 0: return { value: readLen(), end: pos };
    case 1: return { value: -1 - readLen(), end: pos };
    case 2: { const n = readLen(); need(n); const v = buf.subarray(pos, pos + n); pos += n; return { value: Buffer.from(v), end: pos }; }
    case 3: { const n = readLen(); need(n); const v = buf.toString("utf8", pos, pos + n); pos += n; return { value: v, end: pos }; }
    case 4: {
      const n = readLen();
      if (n > 1000) throw new Error("CBOR array too large");
      const arr: Cbor[] = [];
      for (let i = 0; i < n; i++) { const r = cborDecodeAt(buf, pos); arr.push(r.value); pos = r.end; }
      return { value: arr, end: pos };
    }
    case 5: {
      const n = readLen();
      if (n > 1000) throw new Error("CBOR map too large");
      const m = new Map<Cbor, Cbor>();
      for (let i = 0; i < n; i++) {
        const k = cborDecodeAt(buf, pos); pos = k.end;
        const v = cborDecodeAt(buf, pos); pos = v.end;
        m.set(k.value, v.value);
      }
      return { value: m, end: pos };
    }
    case 7:
      if (info === 20) return { value: false, end: pos };
      if (info === 21) return { value: true, end: pos };
      if (info === 22) return { value: null, end: pos };
      throw new Error("Unsupported CBOR simple value");
    default: throw new Error("Unsupported CBOR type");
  }
}
export function cborDecode(buf: Buffer): { value: Cbor; end: number } {
  return cborDecodeAt(buf, 0);
}

// ---------------------------------------------------------------- relying party configuration
export function rpConfig() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const rpId = (process.env.WEBAUTHN_RP_ID || new URL(appUrl).hostname).toLowerCase();
  const listed = (process.env.WEBAUTHN_ORIGINS || `${appUrl},${process.env.CORS_ORIGIN ?? ""}`)
    .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  // Only origins whose host is the RP ID (or a subdomain of it) can ever be valid for that RP ID.
  const origins = listed.filter((o) => {
    try { const h = new URL(o).hostname; return h === rpId || h.endsWith(`.${rpId}`); } catch { return false; }
  });
  return { rpId, rpName: "BidAxiom", origins };
}

// ---------------------------------------------------------------- signed, single-use challenges (no server state)
export interface ChallengeClaims { challenge: string; purpose: "register" | "login"; userId?: string }
const used = new Map<string, number>();
function challengeKey(): Uint8Array {
  const base = process.env.JWT_SECRET ?? "";
  if (base.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
  return createHmac("sha256", base).update("webauthn-challenge-v1").digest();
}
export async function newChallenge(purpose: ChallengeClaims["purpose"], userId?: string) {
  const challenge = b64u(randomBytes(32));
  const token = await new SignJWT({ challenge, purpose, ...(userId ? { userId } : {}) })
    .setProtectedHeader({ alg: "HS256", typ: "webauthn-challenge" }).setIssuedAt().setExpirationTime("5m").sign(challengeKey());
  return { challenge, token };
}
export async function consumeChallenge(token: string, purpose: ChallengeClaims["purpose"]): Promise<ChallengeClaims> {
  const { payload, protectedHeader } = await jwtVerify(token, challengeKey());
  if (protectedHeader.typ !== "webauthn-challenge" || payload.purpose !== purpose) throw new Error("Wrong kind of request");
  const now = Date.now();
  for (const [k, exp] of used) if (exp < now) used.delete(k);
  const id = createHash("sha256").update(token).digest("hex");
  if (used.has(id)) throw new Error("That request was already used");
  used.set(id, now + 6 * 60_000);
  return payload as unknown as ChallengeClaims;
}

// ---------------------------------------------------------------- options for the browser
export function registrationOptions(input: { challenge: string; userId: string; email: string; name: string; existingCredentialIds: string[] }) {
  const rp = rpConfig();
  return {
    challenge: input.challenge,
    rp: { id: rp.rpId, name: rp.rpName },
    user: { id: b64u(Buffer.from(input.userId)), name: input.email, displayName: input.name || input.email },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }, { type: "public-key", alg: -8 }],
    authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
    excludeCredentials: input.existingCredentialIds.map((id) => ({ type: "public-key", id })),
    attestation: "none",
    timeout: 120_000,
  };
}
export function authenticationOptions(challenge: string) {
  return { challenge, rpId: rpConfig().rpId, userVerification: "required", timeout: 120_000 };
}

// ---------------------------------------------------------------- verification
export class PasskeyError extends Error {}
const FLAG_UP = 0x01, FLAG_UV = 0x04, FLAG_AT = 0x40;

function checkClientData(clientDataJSON: Buffer, type: "webauthn.create" | "webauthn.get", challenge: string) {
  let cd: { type?: string; challenge?: string; origin?: string; crossOrigin?: boolean };
  try { cd = JSON.parse(clientDataJSON.toString("utf8")); } catch { throw new PasskeyError("Unreadable passkey response"); }
  if (cd.type !== type) throw new PasskeyError("Wrong kind of passkey response");
  if (cd.challenge !== challenge) throw new PasskeyError("The passkey request does not match. Try again.");
  if (!cd.origin || !rpConfig().origins.includes(cd.origin.replace(/\/$/, ""))) throw new PasskeyError("This passkey response came from an unexpected website.");
  if (cd.crossOrigin === true) throw new PasskeyError("Cross-site passkey use is not allowed.");
}

function checkAuthData(authData: Buffer) {
  if (authData.length < 37) throw new PasskeyError("Unreadable passkey response");
  const rpIdHash = authData.subarray(0, 32);
  const expected = createHash("sha256").update(rpConfig().rpId).digest();
  if (!timingSafeEqual(rpIdHash, expected)) throw new PasskeyError("This passkey belongs to a different website.");
  const flags = authData[32];
  if (!(flags & FLAG_UP)) throw new PasskeyError("The passkey did not confirm you are present.");
  if (!(flags & FLAG_UV)) throw new PasskeyError("The passkey did not verify you (fingerprint, face or PIN).");
  return { flags, counter: authData.readUInt32BE(33) };
}

/** COSE public key → JWK + the algorithm we will verify with. */
function coseToJwk(cose: Map<Cbor, Cbor>): { jwk: JsonWebKey; alg: number } {
  const kty = cose.get(1), alg = cose.get(3);
  const buf = (k: number) => { const v = cose.get(k); if (!Buffer.isBuffer(v)) throw new PasskeyError("Unsupported passkey key"); return v; };
  if (kty === 2 && alg === -7 && cose.get(-1) === 1) return { alg: -7, jwk: { kty: "EC", crv: "P-256", x: b64u(buf(-2)), y: b64u(buf(-3)) } };
  if (kty === 3 && alg === -257) return { alg: -257, jwk: { kty: "RSA", n: b64u(buf(-1)), e: b64u(buf(-2)) } };
  if (kty === 1 && alg === -8 && cose.get(-1) === 6) return { alg: -8, jwk: { kty: "OKP", crv: "Ed25519", x: b64u(buf(-2)) } };
  throw new PasskeyError("This kind of passkey is not supported.");
}

export interface NewCredential { credentialId: string; publicKey: string; alg: number; counter: number; transports: string[]; backedUp: boolean }

export function verifyRegistration(input: {
  response: { id: string; response: { clientDataJSON: string; attestationObject: string; transports?: string[] } };
  challenge: string;
}): NewCredential {
  const clientData = fromB64u(input.response.response.clientDataJSON);
  checkClientData(clientData, "webauthn.create", input.challenge);
  let att: Cbor;
  try { att = cborDecode(fromB64u(input.response.response.attestationObject)).value; } catch { throw new PasskeyError("Unreadable passkey response"); }
  if (!(att instanceof Map)) throw new PasskeyError("Unreadable passkey response");
  const authData = att.get("authData");
  if (!Buffer.isBuffer(authData)) throw new PasskeyError("Unreadable passkey response");
  const { flags, counter } = checkAuthData(authData);
  if (!(flags & FLAG_AT)) throw new PasskeyError("The passkey response had no key in it.");
  if (authData.length < 55) throw new PasskeyError("Unreadable passkey response");
  const idLen = authData.readUInt16BE(53);
  if (authData.length < 55 + idLen) throw new PasskeyError("Unreadable passkey response");
  const credId = authData.subarray(55, 55 + idLen);
  if (b64u(credId) !== input.response.id) throw new PasskeyError("The passkey response is inconsistent.");
  let cose: Cbor;
  try { cose = cborDecode(authData.subarray(55 + idLen)).value; } catch { throw new PasskeyError("Unreadable passkey key"); }
  if (!(cose instanceof Map)) throw new PasskeyError("Unreadable passkey key");
  const { jwk, alg } = coseToJwk(cose);
  createPublicKey({ key: jwk, format: "jwk" }); // throws if the key is malformed
  return {
    credentialId: input.response.id,
    publicKey: JSON.stringify(jwk),
    alg,
    counter,
    transports: (input.response.response.transports ?? []).filter((t) => /^[a-z-]{2,20}$/.test(t)),
    backedUp: Boolean(flags & 0x10),
  };
}

export function verifyAssertion(input: {
  response: { id: string; response: { clientDataJSON: string; authenticatorData: string; signature: string } };
  challenge: string;
  stored: { publicKey: string; alg: number; counter: number };
}): { counter: number } {
  const clientData = fromB64u(input.response.response.clientDataJSON);
  checkClientData(clientData, "webauthn.get", input.challenge);
  const authData = fromB64u(input.response.response.authenticatorData);
  const { counter } = checkAuthData(authData);
  const signed = Buffer.concat([authData, createHash("sha256").update(clientData).digest()]);
  const signature = fromB64u(input.response.response.signature);
  const key = createPublicKey({ key: JSON.parse(input.stored.publicKey) as JsonWebKey, format: "jwk" });
  let ok = false;
  try {
    if (input.stored.alg === -7) ok = cryptoVerify("sha256", signed, { key, dsaEncoding: "der" }, signature);
    else if (input.stored.alg === -257) ok = cryptoVerify("sha256", signed, key, signature);
    else if (input.stored.alg === -8) ok = cryptoVerify(null, signed, key, signature);
  } catch { ok = false; }
  if (!ok) throw new PasskeyError("The passkey signature did not check out.");
  // A counter that goes backwards means the passkey was cloned. Synced passkeys always report 0.
  if ((counter > 0 || input.stored.counter > 0) && counter <= input.stored.counter) throw new PasskeyError("This passkey looks like a copy and was refused.");
  return { counter };
}
