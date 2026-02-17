/**
 * Validates a redirect URL to ensure it is safe (relative, same-origin).
 * Prevents open redirect vulnerabilities.
 *
 * Returns "/" for any URL that is:
 * - falsy (null, undefined, empty string)
 * - not a relative path (does not start with "/")
 * - a protocol-relative URL ("//...")
 * - a backslash bypass ("/\...")
 * - the sign-in page itself (would cause an infinite redirect loop)
 *
 * Otherwise returns the URL unchanged.
 */
export function getSafeRedirectUrl(returnUrl: string | undefined | null): string {
  if (!returnUrl) return "/";
  if (!returnUrl.startsWith("/")) return "/";
  if (returnUrl.startsWith("//")) return "/";
  if (returnUrl.startsWith("/\\")) return "/";
  if (returnUrl.startsWith("/sign-in")) return "/";
  return returnUrl;
}
