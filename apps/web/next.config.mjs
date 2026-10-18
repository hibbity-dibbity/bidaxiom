// Set SKIP_TYPECHECK=1 only for local preview builds (see docker-compose.app.yml).
// Normal builds keep type-checking and linting on.
const skipChecks = process.env.SKIP_TYPECHECK === "1";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The commit this build is made from, read from the repository files (no git program needed). "dev" when unavailable. */
function commitId() {
  try {
    for (const root of [resolve(process.cwd(), "../../.git"), resolve(process.cwd(), ".git")]) {
      if (!existsSync(resolve(root, "HEAD"))) continue;
      const head = readFileSync(resolve(root, "HEAD"), "utf8").trim();
      if (!head.startsWith("ref:")) return head.slice(0, 7);
      const ref = head.slice(4).trim();
      if (existsSync(resolve(root, ref))) return readFileSync(resolve(root, ref), "utf8").trim().slice(0, 7);
      if (existsSync(resolve(root, "packed-refs"))) {
        const line = readFileSync(resolve(root, "packed-refs"), "utf8").split("\n").find((l) => l.endsWith(" " + ref));
        if (line) return line.slice(0, 7);
      }
    }
  } catch {
    /* fall through */
  }
  return "dev";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@construction/shared"],
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_COMMIT: commitId(), NEXT_PUBLIC_BUILD_TIME: new Date().toISOString() },
  typescript: { ignoreBuildErrors: skipChecks },
  eslint: { ignoreDuringBuilds: skipChecks },
};

export default nextConfig;
