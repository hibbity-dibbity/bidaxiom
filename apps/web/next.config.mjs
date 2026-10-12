// Set SKIP_TYPECHECK=1 only for local preview builds (see docker-compose.app.yml).
// Normal builds keep type-checking and linting on.
const skipChecks = process.env.SKIP_TYPECHECK === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@construction/shared"],
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: skipChecks },
  eslint: { ignoreDuringBuilds: skipChecks },
};

export default nextConfig;
