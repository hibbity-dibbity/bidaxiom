// Browser side of passkeys (WebAuthn), using the browser's own credentials API.

const toBuf = (s: string): ArrayBuffer => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const toB64u = (buf: ArrayBuffer | null | undefined): string => {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && typeof window.PublicKeyCredential !== "undefined" && !!navigator.credentials;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Ask the device to make a new passkey. Returns the response to send to the server. */
export async function createPasskey(options: any) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: toBuf(options.challenge),
      user: { ...options.user, id: toBuf(options.user.id) },
      excludeCredentials: (options.excludeCredentials ?? []).map((c: any) => ({ ...c, id: toBuf(c.id) })),
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("No passkey was created");
  const r = cred.response as AuthenticatorAttestationResponse;
  return {
    id: cred.id,
    response: {
      clientDataJSON: toB64u(r.clientDataJSON),
      attestationObject: toB64u(r.attestationObject),
      transports: typeof r.getTransports === "function" ? r.getTransports() : [],
    },
  };
}

/** Ask the device to sign in with one of its passkeys. */
export async function getPasskey(options: any) {
  const cred = (await navigator.credentials.get({
    publicKey: { ...options, challenge: toBuf(options.challenge) },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("No passkey was chosen");
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    response: {
      clientDataJSON: toB64u(r.clientDataJSON),
      authenticatorData: toB64u(r.authenticatorData),
      signature: toB64u(r.signature),
      userHandle: r.userHandle ? toB64u(r.userHandle) : null,
    },
  };
}

/** Friendly text for the ways the browser says no. */
export function passkeyErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "The passkey prompt was cancelled or timed out.";
  if (name === "InvalidStateError") return "This device already has a passkey for your account.";
  return e instanceof Error ? e.message : "Passkey failed";
}
