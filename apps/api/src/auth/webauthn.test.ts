import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign, randomBytes } from "node:crypto";
import { b64u, verifyRegistration, verifyAssertion, rpConfig, newChallenge, consumeChallenge } from "./webauthn.js";

process.env.JWT_SECRET = "x".repeat(40);
process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

// --- tiny CBOR encoder + fake authenticator
const hdr = (major: number, n: number) => n < 24 ? Buffer.from([(major << 5) | n]) : n < 256 ? Buffer.from([(major << 5) | 24, n]) : Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
const cInt = (n: number) => n >= 0 ? hdr(0, n) : hdr(1, -1 - n);
const cBytes = (b: Buffer) => Buffer.concat([hdr(2, b.length), b]);
const cText = (s: string) => Buffer.concat([hdr(3, Buffer.byteLength(s)), Buffer.from(s)]);
const cMap = (pairs: Buffer[][]) => Buffer.concat([hdr(5, pairs.length), ...pairs.flat()]);

const rpIdHash = createHash("sha256").update("app.example.com").digest();
const origin = "https://app.example.com";
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });
const credId = randomBytes(16);

function authData(flags: number, counter: number, withKey: boolean, hash = rpIdHash) {
  const c = Buffer.alloc(4); c.writeUInt32BE(counter);
  const base = Buffer.concat([hash, Buffer.from([flags]), c]);
  if (!withKey) return base;
  const cose = cMap([[cInt(1), cInt(2)], [cInt(3), cInt(-7)], [cInt(-1), cInt(1)], [cInt(-2), cBytes(Buffer.from(jwk.x!, "base64url"))], [cInt(-3), cBytes(Buffer.from(jwk.y!, "base64url"))]]);
  const len = Buffer.alloc(2); len.writeUInt16BE(credId.length);
  return Buffer.concat([base, Buffer.alloc(16), len, credId, cose]);
}
const clientData = (type: string, challenge: string, o = origin) => Buffer.from(JSON.stringify({ type, challenge, origin: o }));
function registration(challenge: string, flags = 0x45, o = origin, hash = rpIdHash) {
  const att = cMap([[cText("fmt"), cText("none")], [cText("attStmt"), cMap([])], [cText("authData"), cBytes(authData(flags, 0, true, hash))]]);
  return { id: b64u(credId), response: { clientDataJSON: b64u(clientData("webauthn.create", challenge, o)), attestationObject: b64u(att), transports: ["internal"] } };
}
function assertion(challenge: string, counter: number, flags = 0x05, o = origin) {
  const cd = clientData("webauthn.get", challenge, o);
  const ad = authData(flags, counter, false);
  const sig = sign("sha256", Buffer.concat([ad, createHash("sha256").update(cd).digest()]), { key: privateKey, dsaEncoding: "der" });
  return { id: b64u(credId), response: { clientDataJSON: b64u(cd), authenticatorData: b64u(ad), signature: b64u(sig) } };
}

test("relying party comes from the app address", () => {
  assert.equal(rpConfig().rpId, "app.example.com");
  assert.deepEqual(rpConfig().origins, [origin]);
});

test("registration then login works", () => {
  const cred = verifyRegistration({ response: registration("chal1"), challenge: "chal1" });
  assert.equal(cred.alg, -7);
  const r = verifyAssertion({ response: assertion("chal2", 1), challenge: "chal2", stored: { publicKey: cred.publicKey, alg: cred.alg, counter: cred.counter } });
  assert.equal(r.counter, 1);
});

test("registration refuses wrong challenge, origin, site, and missing user verification", () => {
  assert.throws(() => verifyRegistration({ response: registration("a"), challenge: "b" }));
  assert.throws(() => verifyRegistration({ response: registration("a", 0x45, "https://evil.example.com"), challenge: "a" }));
  assert.throws(() => verifyRegistration({ response: registration("a", 0x45, origin, createHash("sha256").update("evil.com").digest()), challenge: "a" }));
  assert.throws(() => verifyRegistration({ response: registration("a", 0x41), challenge: "a" }), /verify you/);
});

test("login refuses bad signatures, other keys, no user verification, and cloned counters", () => {
  const cred = verifyRegistration({ response: registration("c"), challenge: "c" });
  const stored = { publicKey: cred.publicKey, alg: cred.alg, counter: 5 };
  const good = assertion("d", 6);
  verifyAssertion({ response: good, challenge: "d", stored });
  assert.throws(() => verifyAssertion({ response: good, challenge: "other", stored }));
  assert.throws(() => verifyAssertion({ response: assertion("d", 5), challenge: "d", stored }), /copy/);
  assert.throws(() => verifyAssertion({ response: assertion("d", 6, 0x01), challenge: "d", stored }), /verify you/);
  const tampered = { ...good, response: { ...good.response, clientDataJSON: b64u(clientData("webauthn.get", "d", "https://evil.example.com")) } };
  assert.throws(() => verifyAssertion({ response: tampered, challenge: "d", stored }));
  const other = generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey.export({ format: "jwk" });
  assert.throws(() => verifyAssertion({ response: good, challenge: "d", stored: { ...stored, publicKey: JSON.stringify(other) } }), /signature/);
});

test("synced passkeys that always report counter 0 are fine", () => {
  const cred = verifyRegistration({ response: registration("c"), challenge: "c" });
  verifyAssertion({ response: assertion("e", 0), challenge: "e", stored: { publicKey: cred.publicKey, alg: cred.alg, counter: 0 } });
});

test("challenges are single use and kind-checked", async () => {
  const { token } = await newChallenge("login");
  await assert.rejects(() => consumeChallenge(token, "register"));
  const t2 = (await newChallenge("login")).token;
  await consumeChallenge(t2, "login");
  await assert.rejects(() => consumeChallenge(t2, "login"), /already used/);
});
