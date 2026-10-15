/**
 * Address of the API for code running in the browser. The app is built with the API at
 * "localhost", which only works on the computer running it. When the page is opened from another
 * device (a phone on the same network, say) the browser's own host name is used instead, so
 * http://192.168.1.20:3000 talks to http://192.168.1.20:3001.
 */
export function browserApiUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  if (typeof window === "undefined") return base;
  // The PDF renderer runs inside the API container and sets this to the API's own address.
  const forced = (window as unknown as { __BIDAXIOM_API_URL__?: string }).__BIDAXIOM_API_URL__;
  if (forced) return forced;
  try {
    const u = new URL(base);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (local && window.location.hostname !== u.hostname) {
      u.hostname = window.location.hostname;
      return u.toString().replace(/\/$/, "");
    }
  } catch {}
  return base;
}
